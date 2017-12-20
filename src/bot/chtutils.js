import debuglog from 'debug-levels';
const fs = require('fs');
const debug = debuglog('SS:ChtUtils');

//Unicode對應注音對照表
var phonetic = {};
//是否忽略聲調
var ignoreTone = true;

//載入注音檔
const loadPhonetic = function loadPhonetic(filepath, ignoreTone2) {
  ignoreTone = ignoreTone2;

  return new Promise(function(resolve, reject) {
    debug.info(`loadPhonetic: ${filepath}`);
    fs.readFile(filepath, function (err, data) {
      if (err) {
        reject(err);
      } else {
        phonetic = JSON.parse(data.toString());
        resolve();
      }
    });
  });
}

//中文轉注音
const toPhonetic = function toPhonetic(strs) {

  const rtnAry = [];
  for(var i = 0 ; i < strs.length; i++ ) {
    var str = strs.substring(i,i+1);
    if (str.charCodeAt(0) > 255) {
      // const unicode = str.charCodeAt(0).toString(16).toUpperCase();
      // while (unicode.length < 4) {
      //   unicode = '0' + unicode;
      // }
      if (phonetic.hasOwnProperty(str)) {
        if (ignoreTone) {
            rtnAry.push("9"+phonetic[str].substring(1));
        } else {
            rtnAry.push(phonetic[str]);
        }
      } else {
        rtnAry.push(str);
      }
    } else {
      rtnAry.push(str);
    }
  }
  return rtnAry.join("");
};

export default {
  loadPhonetic,
  toPhonetic
};
