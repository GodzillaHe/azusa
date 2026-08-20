# かな庭

一个学习日语平假名和片假名的纯前端页面，包含五十音表、浏览器日语发音、翻卡练习、Canvas 临摹与默写、逐笔路径评分、10 题测验和本地进度记录。

## 运行

```bash
cd projects/kana-study
python3 -m http.server 4174
```

然后访问 <http://127.0.0.1:4174>。发音使用浏览器 `SpeechSynthesis` API，可用音色取决于系统安装的日语语音。

## 笔画数据

假名标准笔画路径改编自 [KanjiVG](https://kanjivg.tagaini.net/)，Copyright Ulrich Apel，按 [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/) 许可使用。提取数据见 `stroke-data.js`。
