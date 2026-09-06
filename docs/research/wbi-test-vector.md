# WBI 簽名測試向量

來源：[bilibili-API-collect docs/misc/sign/wbi.md（fork 快照 cfc5fdd）](https://raw.githubusercontent.com/Xiaoyu44/bilibili-API-collect/cfc5fddcc8a94b74d91970bb5b4eaeb349addc47/docs/misc/sign/wbi.md)

本文件從上述來源逐字擷取 WBI 簽名演算法所需的常數與一組**文件本身給出預期輸出**的測試向量，供實作與單元測試比對。程式片段均為原文逐字複製（未修改）。

## 1. mixinKeyEncTab（64 個數字的重排映射表）

文件在演算法說明與各語言 Demo 中反覆給出同一份陣列，內容一致。以下為文件中 JavaScript Demo 版本（逐字擷取）：

```javascript
const mixinKeyEncTab = [
  46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35, 27, 43, 5, 49,
  33, 9, 42, 19, 29, 28, 14, 39, 12, 38, 41, 13, 37, 48, 7, 16, 24, 55, 40,
  61, 26, 17, 0, 1, 60, 51, 30, 4, 22, 25, 54, 21, 56, 59, 6, 63, 57, 62, 11,
  36, 20, 34, 44, 52
]
```

（已核對長度為 64。）

## 2. JS 範例中過濾 value 字元的正則

文件 JavaScript Demo 中 `encWbi` 函式內定義（逐字擷取）：

```javascript
chr_filter = /[!'()*]/g
```

用途：在序列化前過濾參數值中的 `!`、`'`、`(`、`)`、`*` 這五個字元。

## 3. 測試向量（img_key / sub_key / mixin_key）

出自文件「WBI 簽名算法」第 2 步的範例（逐字擷取自原文敘述）：

- `img_key` = `7cd084941338484aae1ad9425b84077c`
- `sub_key` = `4932caff0ff746eab6f01bf08b70ac45`

原文敘述（逐字）：

> 如 `img_key` -> `7cd084941338484aae1ad9425b84077c`、`sub_key` -> `4932caff0ff746eab6f01bf08b70ac45` 经过上述操作后得到 `mixin_key` -> `ea1db124af3c7062474693fa704f4ff8`。

即：

- `mixin_key` = `ea1db124af3c7062474693fa704f4ff8`

此 `mixin_key` 值同時也出現在文件 Rust Demo 的單元測試中（逐字擷取）：

```rust
#[test]
fn test_get_mixin_key() {
    let concat_key =
        "7cd084941338484aae1ad9425b84077c".to_string() + "4932caff0ff746eab6f01bf08b70ac45";
    assert_eq!(
        get_mixin_key(concat_key.as_bytes()),
        "ea1db124af3c7062474693fa704f4ff8"
    );
}
```

## 4. 範例參數、`wts`、與預期輸出 `w_rid`

**文件本身有給出預期輸出**，來源有二處，內容一致：

### 4.1 演算法說明正文（第 3、4 步）

範例參數（原始請求參數，JavaScript Object，逐字擷取）：

```javascript
{
  foo: '114',
  bar: '514',
  zab: 1919810
}
```

`wts` 範例值（逐字擷取）：`1702204169`

正文敘述計算過程（逐字擷取）：

> 随后按键名升序排序后百分号编码 URL Query，拼接前面得到的 `mixin_key`，如 `bar=514&foo=114&wts=1702204169&zab=1919810ea1db124af3c7062474693fa704f4ff8`，计算其 MD5 即为 `w_rid`。

正文第 4 步給出的最終預期輸出（逐字擷取）：

> 如前例最终得到 `bar=514&foo=114&zab=1919810&w_rid=8f6f2b5b3d485fe1886cec6a0be8c5d4&wts=1702204169`。

即：

- 排序後查詢字串（未含 `w_rid`）：`bar=514&foo=114&wts=1702204169&zab=1919810`
- **預期 `w_rid`** = `8f6f2b5b3d485fe1886cec6a0be8c5d4`

### 4.2 Rust Demo 單元測試（完全相同的向量，逐字擷取）

```rust
#[test]
fn test_encode_wbi() {
    let params = vec![
        ("foo", String::from("114")),
        ("bar", String::from("514")),
        ("zab", String::from("1919810")),
    ];
    assert_eq!(
        _encode_wbi(
            params,
            (
                "7cd084941338484aae1ad9425b84077c".to_string(),
                "4932caff0ff746eab6f01bf08b70ac45".to_string()
            ),
            1702204169
        ),
        "bar=514&foo=114&wts=1702204169&zab=1919810&w_rid=8f6f2b5b3d485fe1886cec6a0be8c5d4"
            .to_string()
    )
}
```

此測試與正文範例使用完全相同的 `img_key`、`sub_key`、參數（`foo`/`bar`/`zab`）、`wts=1702204169`，且斷言的預期字串同樣包含 `w_rid=8f6f2b5b3d485fe1886cec6a0be8c5d4`，可互相印證同一組測試向量。

> 備註：文件另有一份 Python Demo 範例（`{'foo': '114', 'bar': '514', 'baz': 1919810}`，注意這裡是 `baz` 不是 `zab`），其 `img_key`／`sub_key` 是程式執行當下即時向 `nav` 介面取得、文件未給出固定值，因此輸出 `w_rid: d3cbd2a2316089117134038bf4caf442` 無法作為可重現的測試向量，僅供參考、不採用。

## 5. 自行驗算（複核用，非文件內容）

為確認上述「文件給出的預期輸出」正確無誤，另外用本機 Python3（`hashlib.md5` + `urllib.parse.urlencode`）依文件演算法重新計算一次，屬於**本文件自行計算**、非原始文件內容：

```python
from functools import reduce
from hashlib import md5
import urllib.parse

mixinKeyEncTab = [
    46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35, 27, 43, 5, 49,
    33, 9, 42, 19, 29, 28, 14, 39, 12, 38, 41, 13, 37, 48, 7, 16, 24, 55, 40,
    61, 26, 17, 0, 1, 60, 51, 30, 4, 22, 25, 54, 21, 56, 59, 6, 63, 57, 62, 11,
    36, 20, 34, 44, 52
]

img_key = "7cd084941338484aae1ad9425b84077c"
sub_key = "4932caff0ff746eab6f01bf08b70ac45"

def getMixinKey(orig):
    return reduce(lambda s, i: s + orig[i], mixinKeyEncTab, '')[:32]

mixin_key = getMixinKey(img_key + sub_key)   # -> ea1db124af3c7062474693fa704f4ff8

params = {'foo': '114', 'bar': '514', 'zab': 1919810, 'wts': 1702204169}
params = dict(sorted(params.items()))
query = urllib.parse.urlencode(params)       # -> bar=514&foo=114&wts=1702204169&zab=1919810
w_rid = md5((query + mixin_key).encode()).hexdigest()
```

實際執行結果：

```
mixin_key: ea1db124af3c7062474693fa704f4ff8
query:     bar=514&foo=114&wts=1702204169&zab=1919810
w_rid:     8f6f2b5b3d485fe1886cec6a0be8c5d4
```

與第 4 節文件本身給出的預期輸出完全一致，驗算通過。

## 6. 完整測試向量摘要

| 項目 | 值 |
| --- | --- |
| `img_key` | `7cd084941338484aae1ad9425b84077c` |
| `sub_key` | `4932caff0ff746eab6f01bf08b70ac45` |
| `mixin_key` | `ea1db124af3c7062474693fa704f4ff8` |
| 原始參數 | `{ foo: '114', bar: '514', zab: 1919810 }` |
| `wts` | `1702204169` |
| 排序後查詢字串 | `bar=514&foo=114&wts=1702204169&zab=1919810` |
| **預期 `w_rid`** | `8f6f2b5b3d485fe1886cec6a0be8c5d4` |
| 完整輸出 | `bar=514&foo=114&zab=1919810&w_rid=8f6f2b5b3d485fe1886cec6a0be8c5d4&wts=1702204169` |
