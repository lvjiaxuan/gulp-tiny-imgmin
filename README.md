该图片压缩插件综合了熊猫压缩和`imagemin`，压缩时会根据熊猫key、网络情况、缓存等不同情况选择压缩方式。

# usage

```js
exports.tiny = () => gulp.src('./test/*')
  .pipe(tiny({
    key: 'tiny api key'
  })).pipe(gulp.dest('./test/tinied'));
```

# options

| 名称     | 类型    | 默认值                | 说明                                                         |
| -------- | ------- | --------------------- | ------------------------------------------------------------ |
| key      | string  | imagemin              | 非必填，key不填（为空）或为imagemin时，选择使用imagemin进行压缩 |
| tinyTag  | string  | `''`                  | 非必填，为压缩后的图片命名追加名称                           |
| minSize  | number  | 4096                  | 非必填，默认为`vue-cli`对图片处理的最小大小                  |
| verbose  | boolean | false                 | 非必填，是否打印更多的信息                                   |
| jsonDest | string  | `./.gulp-tiny-cache/` | 非必填，图片名称json数组，一般配合预加组件使用（连带宣传：[vue-imgs-preload](https://github.com/lvjiaxuan/vue-imgs-preload)） |

# note

- 缓存时，源文件和压缩图片根据源文件名联系，所以改了源文件名不能走缓存