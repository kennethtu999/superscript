#!/usr/bin/env node

import program from 'commander';
import fs from 'fs';
import XLSX from 'xlsx';

const _ = require('lodash');

program
  .version('1.0.2')
  .option('-p, --path [type]', 'Input path', 'xlsx.json')
  .option('-o, --output [type]', 'Output options', './chat')
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
 * 處理單一Excel檔案
 **/
const processXlsxJson = function() {
  fs.readFile(program.path, function (err, data) {
      if (err) throw err;
      processTopics(JSON.parse(data.toString()));
  });
}

/**
 * {"param": {}, "dialog": { "firstChat": [], "entity": [], "txnConfirm": []}, "testCase": []}
 **/
const processTopics = function(topics) {
  topics.forEach( topic => {
    const ary = [];

    processTopic(topic, ary);
    processInnerTopic(topic, ary);

    const fileName = topic.param.txn + ".ss";
    fs.writeFileSync(program.output + "/" + fileName, ary.join(""), (err) => {
      if (err) throw err;
      console.log(`Saved output to ${program.output}/${fileName}`);
    });
  });
  process.exit();
};

/**
 * 產生對外的Topic
 **/
const processTopic = function(topic, ary) {
  //產生第一句對話
  console.log("產生第一句對話");
  ary.push(`> topic ${topic.param.txn}(${topic.param.tag}) {keep}\n`);
  topic.dialog.firstChat.forEach(expr => {

    var re = /\*~9|\$\{\w+\}|\[.*\]/g;
    var matchTimes = 1;
    var replyMessages = [];

    //允許前後為任意字元
    expr = "*~9 " + expr + " *~9";

    //找出cap所有位置，並針對為entity變數的地方做取代
    expr = expr.replace(re, function(match) {
      console.log("matched str: " + match);
      matchTimes++;
      if (match.match(/^\*~9|\[.*\]$/) ) {
        return match;
      } else {
        var varStr = match.substring(2,match.length-1);
        replyMessages.push(`${varStr}: <cap${matchTimes}>`);
        return "*~9";
      };
    });

    var reply = replyMessages.length == 0 ? "{}" : "{" + replyMessages.join(",") + "}";
    ary.push(`  + ${expr}\n`);
    ary.push(`  - ^saveAndRedirect(${reply})\n`);
  })
  ary.push(`\n< topic\n\n\n`);
}

/**
 * 產生補足Entity的Topic
 **/
const processInnerTopic = function(topic, ary) {
  //如果沒有需要補上的Entity則直接離開
  if (!topic.dialog.hasOwnProperty("entity")) {
    return;
  }

  //產生各Entity對話
  console.log("產生各Entity對話");
  ary.push(`> topic ${topic.param.txn}_internal( none ) {keep,system}\n`);
  ary.push("\n");
  ary.push(`  + {ordered} __補足參數\n`);

  //如果沒有entity就先設定為空
  if (!topic.dialog.hasOwnProperty("entity"))
    topic.dialog.entity = [];

  topic.dialog.entity.forEach(entity => {
    ary.push(`  - {^waitEntity("${entity.key}")} ${entity.chat}\n`);
  })

  //產生Entity都己取得時的對話詢問句
  console.log("產生Entity都己取得時的對話詢問句");
  if (topic.dialog.hasOwnProperty('txnConfirm')) {
    //產生對話Reply句
    var paramsStr = topic.dialog.txnConfirm[0];
    topic.dialog.entity.forEach(entity => {
      paramsStr = paramsStr.replace("${"+entity.key+"}",`^getEntity("${entity.key}")`)
    });
    //產生用Regexp找尋對話Reply句的表示式
    var escapeParamStr = paramsStr.replace(/\^|\(|\[|\]|\)|\?|\./g,function(m) { return "\\"+m; });

    ary.push(`  - {^hasAllEntity(${topic.dialog.entity.length})} ${paramsStr}\n`);
    ary.push(`    + (是|對|好) [的|喔]\n`);
    ary.push(`    % * ${escapeParamStr}\n`);
    ary.push(`    - ^doTxn("${topic.param.txn}","")\n`);
  }

  //產生Entity都己取得時的對話詢問句
  console.log("產生Entity都己取得時的對話詢問句");
  if (topic.dialog.hasOwnProperty('txnExec')) {
    //產生對話Reply句
    var paramsStr = topic.dialog.txnExec[0];
    topic.dialog.entity.forEach(entity => {
      paramsStr = paramsStr.replace("${"+entity.key+"}",`^getEntity("${entity.key}")`)
    });
    //產生用Regexp找尋對話Reply句的表示式
    var escapeParamStr = paramsStr.replace(/\^|\(|\[|\]|\)|\?|\./g,function(m) { return "\\"+m; });

    ary.push(`  - {^hasAllEntity(${topic.dialog.entity.length})} ${paramsStr}\n`);
  }

  //取得Entity顧客回覆的值
  console.log("取得Entity顧客回覆的值");
  topic.dialog.entity.forEach(entity => {
    var escapeParamStr = entity.chat.replace(/\w+|\^|\?|\s+|\(|\)|'|"/g, "");
    ary.push("\n");
    ary.push(`  + [從] *~9 [帳號][元]\n`);
    ary.push(`  % * ${escapeParamStr}.*\n`);
    ary.push(`  - {^notCancelTxn(<cap>)} ^saveAndRedirect({${entity.key}:<cap>})\n`);
  })

  ary.push(`\n< topic\n`);
}

processXlsxJson();
