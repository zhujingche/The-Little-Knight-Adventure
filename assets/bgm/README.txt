# BGM 说明 — 小骑士的探险

游戏的占位背景音乐由 WebAudio 程序化生成(原创小调, 地牢氛围, 无版权问题)。

如果你希望循环播放自定义音乐(例如抖音热曲 / 你喜欢的歌),
请把音频文件放入本目录, 命名为:

    assets/bgm/bgm_1.mp3
    assets/bgm/bgm_2.mp3
    assets/bgm/bgm_3.mp3

(支持 .mp3 / .ogg / .wav)
游戏启动时会自动检测并按 1 → 2 → 3 → 1 … 的顺序循环播放, 替换内置占位 BGM。

注意: 「we don't talk anyone / round town / 50 feet」等歌曲版权归其作者/发行方所有,
本游戏不包含任何版权音乐文件, 请自行提供你已获得授权的本地副本。

为什么用服务器运行?
直接双击 index.html (file://) 在部分浏览器无法加载 mp3。请运行:
    node server.js
然后打开 http://127.0.0.1:8123/
