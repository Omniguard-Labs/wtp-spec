# WTP Roadmap

## 当前状态

- 公共标准名固定为 `Wallet Transaction Provenance Standard` / `钱包交易构造溯源标准`。
- `WTP-v1` wire namespace 固定为 `wtv`，包括 `schema = wtv`、`wtv1:` 和 `.well-known/wtv/`。
- EVM profile 覆盖 `legacy`、`eip2930`、`eip1559`、`eip4844`、`eip7702` 和 SafeTx。
- Solana profile 覆盖 legacy 与 v0 transaction。
- 参考 SDK 已支持 envelope 编码/解码、payload hash 校验、来源签名校验、trust metadata 编码/验签和最小一致性测试向量。

## 下一阶段

1. 扩展一致性测试向量，覆盖更多 EVM / Safe / Solana 正反例。
2. 补充 Solana Address Lookup Table、blockhash freshness 和 cluster policy 的规范用例。
3. 明确 Safe owner set、threshold、nonce、EIP-1271 和 approved hash 可信快照要求。
4. 完善 trust metadata 轮换、吊销、缓存和刷新流程。
5. 推进 Go scaffold 到能加载并验证 `test/vectors/wtp-v1-smoke.json`。
6. 增加浏览器端最小验证器示例。

## 暂缓项

- QR 图像层输出。
- 透明日志或审计日志扩展。
- X.509 profile。
- 更高层的 `simulateAndVerify()` API。
