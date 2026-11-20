# DSH Mobile Newline

面向 DSH Web `0.2.2-rc.1` 的本地插件。移动端主聊天框里，普通回车换行，点发送按钮才发送（外接键盘的 `Ctrl+Enter` / `Cmd+Enter` 仍保持 DSH 原生行为）。桌面、提问卡和队列编辑框不改动。有高亮候选时，普通回车仍交给 DSH 选中候选。

## 安装和试用

1. 在 Web 插件设置里停用 `dsh-mobile-keys`。它会在 DOM 捕获阶段截走原始回车，不要与本插件同时启用。
2. 在运行 DSH 的机器上执行（如果不是 `web` profile，替换相应名称）：

   ```sh
   git clone https://github.com/wrvsrx/dsh-mobile-newline.git
   cd dsh-mobile-newline
   dsh plugin --profile web add "link:$PWD"
   ```

   安装使用本地链接，请保留克隆目录。

3. CLI 安装后按部署方式重启 DSH Web，再刷新手机页面。先粘贴 `abc` 后按一次回车，再测试中文候选确认和随后按回车。验证光标换行、草稿保留且没有收到一条新消息，然后再点发送。真机未验证前请勿拿重要草稿试。
4. 要回退，在 Web 插件设置中停用 `dsh-mobile-newline-local`，再刷新。

## 实现与限制

通过捕获监听发现当前聊天框的 Lexical 实例，不拦截 DOM 事件，不模拟 `Shift+Enter`。在 Lexical 中先于 DSH 的发送处理器监听 Enter 命令，把普通回车以及输入法产生的 `null` Enter 转成原生换行命令。已经走 Lexical 原生换行路径的 `beforeinput` 保持原样。无网络请求、无持久化写入。依赖 Lexical 0.49 的内部编辑器引用与命令表，因此固定 DSH 版本；升级后需重新验证。

在本目录执行 `node --test` 运行单元测试。额外指定 `DSH_CHECKOUT=/path/to/dsh`（需要已安装的 `node_modules`）可用该 DSH 自带的 Lexical 跑集成测试；它不替代 Android Chrome + fcitx5-android 真机验收。
