import tinify from 'tinify';
import through from 'through2';
import path from 'path';
import log from 'fancy-log';
import fs from 'fs'
import md5 from 'md5'
import prettyBytes from 'pretty-bytes';
import request from 'request'
import imagemin from 'imagemin';
import imageminOptipng from 'imagemin-optipng';
import imageminJpegtran from 'imagemin-jpegtran';
import imageminGifsicle from 'imagemin-gifsicle';

const CACHE_DIR = './.gulp-tiny-cache/';
const TINY_WEB_API = 'https://tinypng.com/web/shrink';
let hasLog = false;

let isTinyKeyValid: boolean = void 0;// 全局 熊猫key是否有效
const verifyKey: (key: string) => Promise<boolean> =
key => new Promise((resolve, reject) => {

  if(key === 'imagemin') return reject('imagemin');
  if(isTinyKeyValid) return resolve(true);
  if(isTinyKeyValid === false) return resolve(false);

  tinify.key = key;
  tinify.validate(error => {

    if(error) {
      isTinyKeyValid = false;
      if(error.toString().includes('401')) {
        log('熊猫key无效，开始使用web api');
        log('----------------------------');
        return resolve(false);
      }
      return reject(error);
    }

    log('熊猫key有效，开始使用');
    log('---------------------');
    isTinyKeyValid = true;
    resolve(true);
  });
});

let hasCheckTempDir = false;
const createTempDir: () => Promise<void> =
() => new Promise((resolve, reject) => {

  if(hasCheckTempDir) return resolve();

  fs.access(CACHE_DIR, fs.constants.F_OK, errorAccess => {
    if(errorAccess) {
      fs.mkdir(CACHE_DIR, { recursive: true }, errorMkdir => {
        if(errorMkdir) return reject();
        hasCheckTempDir = true;
        resolve();
      });
    } else {
      hasCheckTempDir = true;
      resolve();
    }
  });
});

const readTempFile: (chunk: any) => Promise<Buffer> =
chunk => new Promise((resolve, reject) => {

  const extName = path.extname(chunk.path);
  const fileName = path.basename(chunk.path, extName) + extName;

  fs.readFile(CACHE_DIR + md5(fileName), (error, data) => {
    if(error) return reject();
    resolve(data);
  });
});

const compressByTinyKey: (chunk: any) => Promise<object> =
chunk => new Promise((resolve, reject) => {

  readTempFile(chunk)
    .then(resultData => resolve({ cache: true, resultData }))
    .catch(() => tinify.fromBuffer(chunk.contents).toBuffer((error, resultData) => {
      if(error) return reject(error);
      resolve({ way: 'tinykey', cache: false, resultData });
    }));  
});

const compressByWebApi: (chunk: any) => Promise<object> =
chunk => new Promise((resolve, reject) => {

  const extName = path.extname(chunk.path);
  const fileName = path.basename(chunk.path, extName) + extName;

  readTempFile(chunk)
    .then(resultData => resolve({ cache: true, resultData }))
    .catch(() => request({
      url: TINY_WEB_API,
      method: 'post',
      headers: {
        'accept': '*/*',
        'accept-encoding': 'gzip, deflate, br',
        'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'cache-control': 'no-cache',
        'origin': 'https://tinypng.com',
        'pragma': 'no-cache',
        'referer': 'https://tinypng.com/',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/77.0.3865.90 Safari/537.36',
      },
      body: chunk.contents
    }, (error, response, body) => {

      if(error) return reject('webapi 网络错误');
  
      try {

        request(JSON.parse(body).output.url).pipe(fs.createWriteStream(CACHE_DIR + md5(fileName))).on('close', () => {
          fs.readFile(CACHE_DIR + md5(fileName), (error, data) => {
            if(error) return reject(error);
            resolve({ way: 'webapi', cache: false, resultData: data });
          });
        });
      } catch {

        hasLog = false;
        reject('webapi 响应数据有误');
      }
    }));
});

const compressByImagemin: (chunk: any) => Promise<object> =
chunk => new Promise((resolve, /*reject*/) => {

  readTempFile(chunk)
    .then(resultData => resolve({ cache: true, resultData }))
    .catch(() => imagemin.buffer(chunk.contents, {
      plugins: [
        imageminOptipng(),// https://github.com/imagemin/imagemin-optipng
        imageminJpegtran(),// https://github.com/imagemin/imagemin-jpegtran
        imageminGifsicle(),// https://github.com/imagemin/imagemin-gifsicle
      ]
    }).then(resultData => resolve({ way: 'imagemin', cache: false, resultData })));
});

export = (options: { key?: string, tinyTag?: string, minSize?: number, verbose?: boolean, jsonDest?: string }) => {

  let key = options.key || 'imagemin';
  const { /*key = 'imagemin' , */tinyTag = '', minSize = 4096, verbose = false, jsonDest = CACHE_DIR } = options;

  let tiniedImgs = 0;
  let tiniedPercent = 0;
  let tiniedSize = 0;
  const extNames = ['.jpg', '.png', '.gif'];
  const imgsNames: string[] = [];

  return through.obj((chunk, enc, callback) => {

    if(chunk.isNull()) return callback(null);
    if(chunk.isStream()) return callback('不支持stream');

    const extName = path.extname(chunk.path);
    const fileName = path.basename(chunk.path, extName) + extName;
    const newFileName = path.basename(chunk.path, extName) + tinyTag + extName;
    const chunkSize = chunk.stat.size;

    let resultData: Buffer | Uint8Array = null;
    let cache: boolean = void 0;
    let way = '';

    if(!extNames.includes(extName)) return callback();
    if(chunkSize <= minSize) return callback(null, chunk);

    createTempDir().then(() => {

      verifyKey(key).then((isTinyKeyValid: boolean) => {// or global let isTinyKeyValid

          if(extName === '.gif') {
            return compressByImagemin(chunk);
          } else if(isTinyKeyValid) {
            return compressByTinyKey(chunk);
          } else {
            return compressByWebApi(chunk);
          }
        }).catch(error => {

          if(!hasLog) {
            if(error.toString().includes('connecting')) {
              log.error('莫得网络，开始使用imagemin');
            } else if(error === 'imagemin') {
              log('开始使用imagemin');
              log('-----------------');
            } else {
              log.error(error.toString() + '，开始使用imagemin');
              log('--------------------------------------------');
            }
            hasLog = true;
          }

          key = 'imagemin';
          return compressByImagemin(chunk);
        }).then((data: { way?: string, cache: boolean, resultData: Buffer | Uint8Array }) => {

          resultData = data.resultData;
          cache = data.cache ;
          way = data.way || 'cache';
        }).finally(() => {

          chunk.contents = resultData;
          chunk.path = path.join(chunk.base, newFileName);

          const newChunkSize = resultData.length;
          const savedSize = chunkSize - newChunkSize;
          tiniedSize += savedSize;

          // log一些信息
          if(cache) {

            verbose && log('* from cache:',
              prettyBytes(chunkSize) + ' -> ' + prettyBytes(newChunkSize),
              `(saved ${ prettyBytes(savedSize) } ${ ((savedSize) / chunkSize * 100).toFixed(2) }%)`,
              newFileName);
          } else if(savedSize) {

            tiniedImgs++;
            log(`${ tiniedImgs }.from ${ way }:`,
              prettyBytes(chunkSize) + ' -> ' + prettyBytes(newChunkSize),
              `(saved ${ prettyBytes(savedSize) } ${ ((savedSize) / chunkSize * 100).toFixed(2) }%)`,
              newFileName);
          } else {

            verbose && log('minified saved:', newFileName);
          }

          imgsNames.push(newFileName);
          way !== 'webapi' && fs.createWriteStream(CACHE_DIR + md5(fileName)).write(chunk.contents);
          tiniedPercent += (savedSize / chunkSize * 100);

          callback(null, chunk);
        });
    }).catch(error => callback(error));
  }, callback => {

    if(tiniedImgs) {
      log(`已压缩图片：${ tiniedImgs } 总节省空间大小${ prettyBytes(tiniedSize) } 总节省空间百分比：${ (tiniedPercent / tiniedImgs).toFixed(2) }%`);
    } else {
      log('没有需要被压缩的图片');
    }

    fs.mkdir(jsonDest, { recursive: true }, error => !error && fs.createWriteStream(path.join(jsonDest, 'imgs.json')).write(JSON.stringify(imgsNames)));
    isTinyKeyValid && log('本月熊猫key已压缩图片：' + tinify.compressionCount);

    callback();
  });
}