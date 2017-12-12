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
    expr = expr.replace(re, function(match) {
      console.log("matched str: " + match);
      matchTimes++;
      if (match.match(/^\*~9|\[.*\]$/) )
        return match;
      else {
        var varStr = match.substring(2,match.length-1);
        replyMessages.push(`^saveEntity('${varStr}',<cap${matchTimes}>)`)
      }
        return "*~9";
    });

    ary.push(`  + ${expr}\n`);
    ary.push(`  - ${replyMessages.join(' ')} ^topicRedirect("${topic.param.txn}_internal","__補足參數")\n`);
  })
  ary.push(`\n< topic\n\n\n`);
}

/**
 * 產生補足Entity的Topic
 **/
const processInnerTopic = function(topic, ary) {
  //產生各Entity對話
  console.log("產生各Entity對話");
  ary.push(`> topic ${topic.param.txn}_internal(${topic.param.tag}) {keep,system}\n`);
  ary.push("\n");
  ary.push(`  + {ordered} __補足參數\n`);
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
    ary.push(`    - 好的，謝謝您，系統立即為您進行此項交易 ^doTxn("${topic.param.txn}")\n`);
  }

  //取得Entity顧客回覆的值
  console.log("取得Entity顧客回覆的值");
  topic.dialog.entity.forEach(entity => {
    var escapeParamStr = entity.chat.replace(/\w+|\^|\?|\s+|\(|\)|'|"/g, "");
    ary.push("\n");
    ary.push(`  + [從] *~9 [帳號][元]\n`);
    ary.push(`  % * ${escapeParamStr}.*\n`);
    ary.push(`  - ^saveEntity('${entity.key}',<cap>) ^topicRedirect("${topic.param.txn}_internal","__補足參數")\n`);
  })

  ary.push(`\n< topic\n`);
}

processXlsxJson();
