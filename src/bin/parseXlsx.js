#!/usr/bin/env node

import program from 'commander';
import fs from 'fs';
import XLSX from 'xlsx';

const _ = require('lodash');

program
  .version('1.0.2')
  .option('-p, --path [type]', 'Input path', './xlsx')
  .option('-o, --output [type]', 'Output options', 'xlsx.json')
  .option('-f, --force [type]', 'Force save if output file already exists', false)
  .parse(process.argv);

/**
 * 如果輸出檔案己存在且沒有force則就直接離開
 */
fs.exists(program.output, (exists) => {
  if (exists && !program.force) {
    console.log('File', program.output, 'already exists, remove file first or use -f to force save.');
    return process.exit();
  }
});

/**
 * 處理所有Excel檔案, 暫存檔不處理
 **/
const processAllXlsx = function(filePath,options) {
  var allDialogs = [];

  fs.readdir(program.path, (err, files) => {
    files.forEach(file => {
      if (!/^~.*/.test(file)) {
        console.log(`處理檔案: ${file}`);
        _.merge(allDialogs, processXlsx(program.path + "/" + file,options));
      }
    });

    fs.writeFile(program.output, JSON.stringify(allDialogs, null, 4), (err) => {
      if (err) throw err;
      console.log(`Saved output to ${program.output}`);
      process.exit();
    });
  })

  //'/Users/kenneth/git/ai/bbot/ss-bot-instance/xlsx/對話表示式.xlsx'
};

/**
 * 處理單一Excel檔案
 **/
const processXlsx = function(filePath,options) {
  const opts = {};
  const workbook = XLSX.readFile(filePath, options);

  var dialogs = [];
  workbook.SheetNames.forEach( sheetName => {
    console.log(`SheetName: ${sheetName}`);
    const worksheet = workbook.Sheets[sheetName];
    console.log(`REGION: ${worksheet['!ref']}`);

    const maxRow = parseInt(worksheet['!ref'].split(":")[1].replace( /^\D+/g, ''),10);
    console.log(`MaxRow: ${maxRow}`);

    var dataSet = {};
    for (var i = 1 ; i<=maxRow ; i++) {
      if (!isEmpty(worksheet, "A"+i) && worksheet["A"+i].v == "參數") {
        i = processParameter(worksheet, dataSet, i+2);
      }

      if (!isEmpty(worksheet, "A"+i) && worksheet["A"+i].v == "對話內容") {
        i = processDialog(worksheet, dataSet, i+2);
      }

      if (!isEmpty(worksheet, "A"+i) && worksheet["A"+i].v == "驗證內容") {
        i = processTestCase(worksheet, dataSet, i+2);
      }
    }
    dialogs.push(dataSet);
  })
  return dialogs;
}


/**
 * 判斷Cell是否為空白
 **/
const isEmpty = function(worksheet, pos) {
  return !worksheet.hasOwnProperty(pos) || /^\s*$/.test(worksheet[pos].v);
}


/**
 * 匯入對話參數
 **/
const paramMapping = {"交易代號" : "txn" , "主題標籤" : "tag"};
const processParameter = function(worksheet, dataSet, index) {
  dataSet.param = {};
  while(true) {
    if (isEmpty(worksheet, "A"+index)) break;
    var key = worksheet["A"+index].v;
    var value = worksheet["B"+index].v;
    dataSet.param[paramMapping[key]]=value;
    index++;
  }
  return index+1;
}


/**
 * 匯入對話內容
 **/
const processDialog = function(worksheet, dataSet, index) {
  dataSet.dialog = {};

  if (worksheet["A"+index].v == "入口點") {
    dataSet.dialog.firstChat=[];
    do {
      var boo = isEmpty(worksheet, "A"+index);
      console.log(`入口點 index:${index}   isEmpty  ${boo}`);

      dataSet.dialog.firstChat.push(worksheet["D"+index].v );
      index++;

    } while(isEmpty(worksheet, "A"+index));
  }

  if (worksheet["A"+index].v == "交易個體") {

    dataSet.dialog.entity=[];
    do {
      var boo = isEmpty(worksheet, "A"+index);
      console.log(`交易個體 index:${index}   isEmpty  ${boo}`);

      var entity = {
        "key":worksheet["B"+index].v,
        "desc":worksheet["C"+index].v,
        "chat":worksheet["D"+index].v
      };
      if (!isEmpty(worksheet, "E"+index)) entity.expr = worksheet["E"+index].v;
      dataSet.dialog.entity.push(entity);
      index++;
    } while(isEmpty(worksheet, "A"+index));
  }

  if (worksheet["A"+index].v == "執行前確認") {
    dataSet.dialog.txnConfirm=[];
    do {
      var boo = isEmpty(worksheet, "A"+index);
      console.log(`執行前確認 index:${index}   isEmpty  ${boo}`);

      dataSet.dialog.txnConfirm.push(worksheet["D"+index].v );
      index++;
    } while(isEmpty(worksheet, "A"+index) && !isEmpty(worksheet, "D"+index));
  }

  return index+1;
}

/**
 * 匯入測試案例
 **/
const processTestCase = function(worksheet, dataSet, index) {
  if (!dataSet.hasOwnProperty("testCase")) dataSet.testCase = [];

  var caseData =[];
  while(true) {
    if (isEmpty(worksheet, "A"+index)) break;

    var boo = isEmpty(worksheet, "A"+index);
    console.log(`測試案例 index:${index}   isEmpty  ${boo}`);

    caseData.push({
      type : worksheet["A"+index].v == "輸入" ? "input" : "reply",
      message : "" + worksheet["B"+index].v
    });
    index++;
  }
  dataSet.testCase.push(caseData);
  return index+1;
}

processAllXlsx();
