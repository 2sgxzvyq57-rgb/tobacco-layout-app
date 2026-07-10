# 豆包 API 配置指南

## 获取 API 密钥

### 步骤 1：注册火山引擎账号
1. 访问 https://www.volcengine.com/
2. 点击"注册"按钮
3. 完成账号注册

### 步骤 2：开通豆包服务
1. 登录后访问 https://www.volcengine.com/product/doubao
2. 点击"立即开通"
3. 完成服务开通

### 步骤 3：创建 API 密钥
1. 进入火山引擎控制台
2. 在左侧菜单选择"密钥管理"
3. 点击"创建密钥"
4. 复制生成的 API Key（格式如：`xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`）

### 步骤 4：配置环境变量

#### 本地开发环境
1. 在项目根目录创建 `.env.local` 文件
2. 添加以下内容：
```bash
DOUBAO_API_KEY=your_api_key_here
```
3. 将 `your_api_key_here` 替换为你的实际 API Key

#### Vercel 部署环境
1. 进入 Vercel 项目控制台
2. 点击 "Settings" → "Environment Variables"
3. 添加新环境变量：
   - Name: `DOUBAO_API_KEY`
   - Value: 你的豆包 API Key
4. 点击 "Save"
5. 重新部署项目

## 费用说明

豆包 API 采用按量计费：
- 输入：0.01 元 / 千 tokens
- 输出：0.01 元 / 千 tokens
- 新用户有免费额度

## 模型选择

当前代码使用 `doubao-pro-32k` 模型，你也可以根据需要修改：
- `doubao-pro-32k`：32K 上下文，适合长文本
- `doubao-lite-32k`：更便宜，速度更快
- `doubao-pro-128k`：128K 上下文

修改位置：`src/app/api/parse-layout/route.ts` 第 67 行

## 测试配置

配置完成后，可以通过以下方式测试：

1. 启动开发服务器：`pnpm dev`
2. 访问应用
3. 输入语音或文本描述
4. 点击"生成布局图"
5. 如果成功生成布局图，说明配置成功

## 常见问题

### Q: 提示"未配置豆包 API 密钥"
A: 检查 `.env.local` 文件是否存在，`DOUBAO_API_KEY` 是否正确配置

### Q: API 调用失败
A: 检查 API Key 是否正确，网络是否正常，账户余额是否充足

### Q: 返回格式错误
A: 可能是模型返回了非 JSON 格式，检查模型版本和 prompt
