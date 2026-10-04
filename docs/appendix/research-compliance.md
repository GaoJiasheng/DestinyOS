# 天机 / DestinyOS 合规调研报告（AdSense + Stripe 订阅 + Google 登录的中英双语占星/塔罗/命理网站）

- 调研日期（所有「访问日期」均为）：**2026-10-04**
- 方法：使用 WebFetch 直接访问官方政策页并摘录原文；官方页面无法抓取时用 WebSearch 结果交叉印证并明确标注。
- 标注约定：
  - **【官方原文】** = 来自官方政策/法规页面的直接摘录（英文保留原文，必要时附中文释义）
  - **【推断】** = 基于原文对本项目的分析/建议，非官方表述，不构成法律意见
  - **【未核实】** = 本次未能直接访问到原文，仅凭二手来源或既有知识，需复核

> 总体结论速览
> 1. AdSense：占星/塔罗/算命/风水**不在** Google 的「禁止内容」与「发布商限制（受限内容）」清单中，可以投放；真正的红线是「不可靠且有害的声明」（健康疗效、与科学共识相悖的健康说法）、「误导性内容」。
> 2. 同意管理：EEA/UK/瑞士必须用 Google 认证 CMP（TCF），AdSense 自带「隐私与消息」已被 Google 声明为「符合 TCF 要求的认证方案」，起步阶段够用；美国各州用 AdSense 的「US state regulations message」+ RDP。
> 3. GDPR：出生日期/时辰/出生地是**普通个人数据**（不在 Art.9 清单内）；但若产品**推断**用户的宗教/哲学信仰或据此差别对待，ICO 明确视为特殊类别数据。
> 4. COPPA：一般受众网站采「实际知情」标准；但本站以出生日期为核心输入，一旦用户填入 <13 岁的生日即构成实际知情，必须在注册流程阻断。CCPA/CPRA 门槛（$25M 收入 / 10 万加州消费者 / 50% 收入来自卖数据）早期大概率不达，但 AdSense 个性化广告属 CPRA「share」，建议从第一天就上 Do Not Sell or Share 链接。
> 5. Stripe 全球禁止/受限清单**未**列占星/算命（仅日本、墨西哥、泰国的本地清单禁止「Psychic services and fortune tellers」）；**Paddle 明确禁止**「pseudo-science, including clairvoyance, horoscopes, fortune-telling」；Lemon Squeezy 未明示禁止。
> 6. Google 登录只用 openid/email/profile → 非敏感 scope，无需 OAuth 验证，但要有托管在同域、首页可达的隐私政策，并将「Testing」状态切到「In production」。
> 7. Vercel/Cloudflare 条款对占卜内容无限制；但 **Vercel Hobby 计划禁止商业用途（含 AdSense）**，必须用 Pro。
> 8. 商标：「DestinyOS」未见同名注册，但 Bungie 持有大量「DESTINY」软件/游戏类商标，且 Pattern Inc. 2026-08 新申请了「DESTINY」；「天机」在中国已有第 45 类（含占星/算命服务所在类别）注册记录（北京融世纪，注册号 24016181A），且是命理行业高频通用词，冲突风险高。

---

## 1. Google AdSense 发布商政策：占星/塔罗/算命/风水是否允许

### 1.1 Google Publisher Policies（禁止内容）
- 来源：https://support.google.com/publisherpolicies/answer/10502938 （访问日期 2026-10-04）
- **【官方原文】** 禁止类别包括：Illegal content；Intellectual property abuse；Dangerous or derogatory content；Animal cruelty；Misrepresentative content；Unreliable and harmful claims；（另有 Enabling dishonest behavior、Sexually explicit content、Child sexual abuse 等）。
- **【官方原文】** Misrepresentative content：禁止内容 "falsely implies having an affiliation with, or endorsement by, another individual, organization..."
- **【官方原文】** Unreliable and harmful claims：Google 不允许内容 "makes claims that are demonstrably false and could significantly undermine participation or trust in an electoral or democratic process", "promotes harmful health claims, or relates to a current, major health crisis and contradicts authoritative scientific consensus"；示例 "Anti-vaccine advocacy, denial of the existence of medical conditions such as AIDS or Covid-19"。
- **【官方原文】** 该页面**没有**任何关于 astrology / fortune telling / tarot / psychic 的条目。

### 1.2 Google Publisher Restrictions（受限内容，可投放但广告来源减少）
- 来源：https://support.google.com/publisherpolicies/answer/10437795 （访问日期 2026-10-04）
- **【官方原文】** "Publisher restrictions identify content that is restricted from receiving certain sources of advertising. If your content is labeled with an inventory restriction, fewer advertising sources will be eligible to bid on it."
- **【官方原文】** 受限类别全部清单：Sexual content；Shocking content；Explosives；Guns, gun parts, and related products；Other weapons；Tobacco；Recreational drugs；Alcohol sale or misuse；Online gambling；Prescription drugs；Unapproved pharmaceuticals and supplements；App removed from Google Play Store。
- **【官方原文】** 清单中**不含**占星、塔罗、算命、风水、灵媒等任何类别。

### 1.3 AdSense Program Policies
- 来源：https://support.google.com/adsense/answer/48182 （访问日期 2026-10-04）
- **【官方原文】** 要求遵守 Google Publisher Policies 与 Google Publisher Restrictions；禁止 "Any method that artificially generates clicks or impressions on your Google ads"；禁止误导性标签、以及导航设计 "intentionally mislead users"。无占星相关条目。

### 1.4 【推断】对本项目的结论
- 占星/塔罗/八字/紫微/风水内容本身**不是禁止内容，也不是受限内容**，可以正常投放 AdSense。
- 具体禁止点（需在产品文案与 UGC 审核中规避）：
  1. **健康声明**：不得称某命盘/风水布局/水晶/符咒可治愈、预防或缓解疾病，不得给出与医学共识相悖的健康建议（触发 "Unreliable and harmful claims"）。
  2. **虚假宣称/冒充**：不得暗示与宗教机构、名人、官方的关联或认可（"Misrepresentative content"）。
  3. **误导性用户体验**：不得用「点此查看你的命运」等按钮伪装广告、不得诱导点击。
  4. 保险做法：全站挂「仅供娱乐/参考，不构成医疗、法律、财务建议」免责声明（见第 5 节）。
- 实务中 AdSense 另一常见拒绝原因是「低价值/自动生成内容」（本次未专项核实），对 AI 生成解读要保证有原创、对用户有价值的编辑内容。

### 1.5 Google Ads 广告主侧「占星与神秘学」政策是否影响发布商
- **Google Ads「Other restricted businesses」**：https://support.google.com/adspolicy/answer/6368711 （访问日期 2026-10-04）—— **【官方原文】** 该页列出的受限业务为 Government documents and official services、Free desktop software、Event ticket sales、Technical support、Fund solicitation、Food and beverage、Local services、Consumer advisories、Call directory services、Bail bond services、Dating services 等，**无** astrology/psychic/fortune telling 条目。
- **Google Ads「Misrepresentation」**：https://support.google.com/adspolicy/answer/6020955 （访问日期 2026-10-04）—— **【官方原文】** Unreliable claims: "Making inaccurate claims or claims that entice the user with an improbable result (even if this result is possible) as the likely outcome a user can expect is not allowed."；Misleading representation: "Making misleading statements, obscuring, or omitting material information about your identity, affiliations, or qualifications is not allowed."
- **Google Ads「Personalized advertising」敏感兴趣类别**：https://support.google.com/adspolicy/answer/143465 （访问日期 2026-10-04）—— **【官方原文】** 敏感类别清单含 "Religious beliefs"（以及 Health、Negative financial status、Relationship hardships 等）；**【官方原文】** "Advertisers promoting products and services that fall within sensitive interest categories are unable to use advertiser-curated audiences." —— 这是**广告主侧**政策，不直接约束发布商。
- **AdSense/Ad Manager 发布商「敏感类别屏蔽」**：https://support.google.com/adsense/answer/164131 与 https://support.google.com/admanager/answer/2541069 （访问日期 2026-10-04）—— **【官方原文】** 存在一个可被发布商屏蔽的广告类别 "Astrology and esoteric: Includes zodiac, horoscopes, love spells, potions, and psychic-related ads. (This category is specific to English and Portuguese)"；Ad Manager 页面标注该类别 "deprecated and will be removed from Google Ad Manager on October 23, 2026"。
- **【推断】** 结论：Google Ads 侧目前没有专门针对占星/神秘学的「受限业务」政策；对发布商的影响仅是间接的——
  1. 若你日后**自己投 Google Ads 推广**本站，广告文案受 Misrepresentation 政策约束（不能承诺「必准」「改运」「保证复合/发财」），且因与「Religious beliefs」等敏感类别可能关联而**不能用自建受众做个性化投放**。
  2. 「Astrology and esoteric」是**广告**的敏感类别（部分品牌广告主会屏蔽把广告投到此类广告旁或此类站点），这可能略微压低占星站的 CPM，但不构成合规问题。该类别即将下线，影响更小。

---

## 2. AdSense 的用户同意（GDPR / UK / 瑞士；美国各州）要求

### 2.1 Google EU User Consent Policy
- 来源：https://www.google.com/about/company/user-consent-policy/ （访问日期 2026-10-04）
- **【官方原文】** 适用范围："European Economic Area, the UK and Switzerland"。必须取得合法有效同意用于："the use of cookies or other local storage where legally required" 以及 "the collection, sharing, and use of personal data for personalization of ads"。必须 "retain records of consent given by end users"、"provide end users with clear instructions for revocation of consent"、"clearly identify each party that may collect, receive, or use end users' personal data"。

### 2.2 Google 认证 CMP + TCF 要求
- 来源：https://support.google.com/adsense/answer/13554116 （访问日期 2026-10-04）
- **【官方原文】** "As of 16 January 2024, a certified CMP integrated with the TCF is required when serving personalized ads to users in the EEA and UK."；"As of 31 July 2024, a certified CMP integrated with the TCF is required when serving personalized ads to users in Switzerland."
- **【官方原文】** 若无认证 CMP，流量只能获得 "non-personalized ads or limited ads (including programmatic limited ads) where supported"。
- **【官方原文】** Google 的替代方案："Privacy & messaging" 中的 "European regulations messages" 被描述为 "certified in accordance with the new TCF requirement"。
- 来源：https://support.google.com/adsense/answer/13790256 （访问日期 2026-10-04）—— **【官方原文】** "the European regulations message available to Ad Manager, AdSense, and AdMob publishers in the 'Privacy & messaging' tab are certified in accordance with the new TCF requirement."；同时 "we encourage publishers to consider which CMP solution is best for them"。
- 搜索印证（二手，Google 帮助页摘要）：若创建了 GDPR 消息但未发布，"Google will publish a default GDPR message for you using Google's own CMP"，默认选项为 "Consent, Do not consent, or Manage options"，不可自定义样式。【未核实原文段落，但出自 support.google.com 搜索摘要】

### 2.3 美国各州：US state regulations message + Restricted Data Processing (RDP)
- 来源：https://support.google.com/adsense/answer/10961479 （访问日期 2026-10-04）
- **【官方原文】** 适用州："California, Colorado, Connecticut, Delaware, Florida, Indiana, Iowa, Kentucky, Maryland, Minnesota, Montana, Nebraska, New Hampshire, New Jersey, Oregon, Rhode Island, Tennessee, Texas, Utah, Virginia"。
- **【官方原文】** 消息会显示 "your 'Do Not Sell or Share My Personal Information' link"，点击后弹出 "Opt out of the sale or sharing of personal information" 对话框；"It is your responsibility to make sure your messages meet legal requirements."；"CPRA is now in effect. This means that users can opt out of the sale and sharing of their personal information."
- 来源：https://business.safety.google/rdp/ （访问日期 2026-10-04）
- **【官方原文】** "With restricted data processing, Google restricts how it uses certain unique identifiers, and other data processed in the provision of services to you, to only undertake certain business purposes."；"Google will act as your service provider (or processor) with respect to data processed while restricted data processing is enabled" —— 但页面注明自 2023-07-01 起**在加州对跨情境行为广告不再适用**；可 "on a per-user basis (for example, following a user opt-out by clicking on a 'Do Not Sell My Personal Information' link)" 或对适用州全部用户启用；"may choose to enable restricted data processing when they receive a GPC opt-out signal"。
- 来源：https://support.google.com/adsense/answer/14126816 （访问日期 2026-10-04）—— **【官方原文】** 支持 IAB GPP 字符串（"US National, California, Colorado, Connecticut, Florida, Virginia" 等段）；用户拒绝 "Sale of the Consumer's Personal Information" 或 "Sharing..." 时触发 RDP；也可用账户级 "Restricted data processing settings"。

### 2.4 【推断】AdSense 自带「隐私与消息」是否够用
- **够用的场景**：只投 AdSense、无其他第三方广告/追踪 SDK、不需要把同意信号同步给自建分析/营销工具。Google 自家消息已满足「认证 CMP + TCF」要求，且免费、自动处理 EEA/UK/CH 地域判断与 US 州消息。
- **不够用的场景**：
  1. 你用了 GA4、Meta Pixel、TikTok Pixel、Hotjar 等——这些不受 Google 消息控制，需要一个能向所有脚本分发同意状态（含 Google Consent Mode v2）的通用 CMP（如 CookieYes / Usercentrics / Didomi / Osano 等认证 CMP）。
  2. 你需要同时覆盖「Cookie 同意」+「GDPR 的网站自身数据处理同意」+「邮件营销同意」统一记录。
  3. 中英双语定制文案与品牌样式（Google 默认消息样式不可自定义）。
- 建议：MVP 阶段用 AdSense Privacy & messaging（同时开启 European regulations message 与 US state regulations message，并勾选对 GPC 信号自动触发 RDP）；一旦接入第二个追踪脚本就迁移到 Google 认证 CMP 列表中的第三方 CMP。
- 另注意 ePrivacy/Cookie 法与 GDPR 是分开的：即使用户拒绝个性化广告，你仍需记录「同意记录」并提供撤回入口（EU User Consent Policy 明文要求）。

---

## 3. GDPR / UK GDPR：出生日期与出生地的数据类别、法律基础、隐私政策必备条款、可携与删除、保留期

### 3.1 数据类别
- Art. 9(1) 来源：https://gdpr-info.eu/art-9-gdpr/ （访问日期 2026-10-04）—— **【官方原文】** "Processing of personal data revealing racial or ethnic origin, political opinions, religious or philosophical beliefs, or trade union membership, and the processing of genetic data, biometric data for the purpose of uniquely identifying a natural person, data concerning health or data concerning a natural person's sex life or sexual orientation shall be prohibited."
- ICO 特殊类别指南来源：https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/lawful-basis/special-category-data/what-is-special-category-data/ （访问日期 2026-10-04）—— **【官方原文】** 特殊类别为 racial or ethnic origin / political opinions / religious or philosophical beliefs / trade union membership / genetic / biometric (for identification) / health / sex life / sexual orientation。
- **【官方原文】（ICO 关于推断）** 推断属于特殊类别数据的情形："your processing intends to make an inference linked to one of the special categories of data; or you intend to treat someone differently on the basis of inferred information linked to one of the special categories."；"If you carry out any form of profiling which infers things like ethnicity, beliefs, politics, health status (condition or risks), sexual orientation or sex life, you will be processing special category data."
- **【推断】**
  - 出生日期、出生时辰、出生地：**普通个人数据**（不在 Art.9 清单）。但三者组合是高唯一性的识别信息，且出生地可能间接暗示民族/国籍，建议按「较敏感的普通数据」加密存储、最小化展示。
  - 占星/八字/塔罗**内容本身**不等于用户的「宗教或哲学信仰」。风险点在于：
    1. 若让用户填写「宗教信仰」「是否信命」「所属流派」等字段 → 直接构成 Art.9 数据，需 Art.9(2)(a) 明示同意（explicit consent）。
    2. 若用算法**推断**「该用户信奉某宗教/哲学体系」并据此推送差异化内容/广告 → 按 ICO 口径即为特殊类别处理。
    3. 若生成「健康运势」并涉及疾病倾向等描述 → 可能被视为对健康的推断，建议限制在泛泛的「注意休息」层面，避免具体病症预测。
  - 建议：**不采集**宗教/信仰字段；UI 文案强调「文化/娱乐/自我反思工具」；避免把命盘结论用于广告定向（AdSense 不要传递自定义受众信号）。

### 3.2 法律基础（Art. 6）
- 来源：https://gdpr-info.eu/art-6-gdpr/ （访问日期 2026-10-04）
- **【官方原文】** 6(1)(a) "the data subject has given consent to the processing of his or her personal data for one or more specific purposes"；6(1)(b) "processing is necessary for the performance of a contract to which the data subject is party..."；6(1)(f) "processing is necessary for the purposes of the legitimate interests pursued by the controller or by a third party, except where such interests are overridden by the interests or fundamental rights and freedoms of the data subject..., in particular where the data subject is a child"。
- **【推断】建议映射**：
  | 处理活动 | 建议法律基础 |
  |---|---|
  | 用出生日期/时辰/地点生成命盘并保存到账户 | Art.6(1)(b) 合同履行（用户要求的服务） |
  | 账户登录、Stripe 订阅计费、发票 | 6(1)(b) 合同 + 6(1)(c) 法定义务（税务记账） |
  | 个性化广告 Cookie / AdSense 个性化 | 6(1)(a) 同意（经 TCF CMP） |
  | 安全日志、防欺诈、基础统计 | 6(1)(f) 合法利益（需做 LIA 记录） |
  | 营销邮件 | 同意（ePrivacy/PECR 口径） |
  | 任何宗教/信仰字段（如有） | Art.9(2)(a) 明示同意，且建议直接不采集 |

### 3.3 隐私政策必须包含的条款（Art. 13）
- 来源：https://gdpr-info.eu/art-13-gdpr/ （访问日期 2026-10-04）
- **【官方原文】** 13(1)：控制者身份与联系方式（及代表）；DPO 联系方式（如适用）；处理目的与法律基础；合法利益内容（如依据 6(1)(f)）；接收方或接收方类别；第三国传输及保障措施。13(2)："the period for which the personal data will be stored, or if that is not possible, the criteria used to determine that period"；访问、更正、删除、限制、反对、可携权；"the existence of the right to withdraw consent at any time"；"the right to lodge a complaint with a supervisory authority"；提供数据是否为法定/合同要求及不提供的后果；"meaningful information about the logic involved" in automated decision-making。
- **【推断】本项目额外应写入**：Google（AdSense/OAuth）、Stripe、Vercel/Cloudflare 作为接收方/处理者；美国托管 → 第三国传输（EU-US Data Privacy Framework 认证状态或 SCCs）；若在 EU/UK 无实体需说明是否指定 Art.27 代表；AI 生成解读的说明（非法律意义上的 Art.22 决策，但建议解释逻辑）；中英文版本一致性声明。

### 3.4 数据可携与删除
- Art.20(1) 来源：https://gdpr-info.eu/art-20-gdpr/ （访问日期 2026-10-04）—— **【官方原文】** "the right to receive the personal data concerning him or her, which he or she has provided to a controller, in a structured, commonly used and machine-readable format and have the right to transmit those data to another controller..." 适用条件：基于同意或合同、且自动化处理。
- Art.17(1) 来源：https://gdpr-info.eu/art-17-gdpr/ （访问日期 2026-10-04）—— **【官方原文】** 删除权 "without undue delay"，理由含 (a) 数据对目的不再必要；(b) 撤回同意且无其他法律依据；(c) 行使反对权；(d) 非法处理；(f) 与 Art.8(1) 向儿童提供信息社会服务相关。
- **【推断】实现建议**：账户设置内提供「导出我的数据」（JSON/CSV，含出生资料、已保存命盘、订阅记录）与「删除账户」自助按钮；删除后 30 天内硬删除生产库与备份中的可识别数据（备份保留需在政策中披露）；Stripe 侧的交易记录因税务法定义务保留，隐私政策中说明。

### 3.5 数据保留期建议
- ICO 存储限制来源：https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/data-protection-principles/a-guide-to-the-data-protection-principles/storage-limitation/ （访问日期 2026-10-04）—— **【官方原文】** "The UK GDPR does not set specific time limits for different types of data. This is up to you."；"You need to establish and document standard retention periods for different categories of information you hold wherever possible."；"You should review whether you still need personal data at the end of any standard retention period, and erase or anonymise it unless there is a clear justification for keeping it for longer."
- **【推断】建议保留表**（写入隐私政策）：
  | 数据 | 保留期 |
  |---|---|
  | 账户与出生资料、保存的命盘 | 账户存续期间；账户删除后 ≤30 天清除 |
  | 不活跃账户 | 24–36 个月无登录 → 邮件提醒后删除/匿名化 |
  | 匿名访客的一次性测算输入 | 不落库，或仅会话级/24 小时 |
  | 服务器/安全日志（含 IP） | 30–90 天 |
  | 同意记录（CMP） | 按 Google 要求保留；常见做法 ≥ 同意有效期（TCF 常用 13 个月）+ 可审计 |
  | 计费/发票（Stripe） | 按税法：美国常见 7 年、英国 6 年、欧盟各国 5–10 年（具体年限为我的常识，未在本次核实） |
  | 客服邮件 | 结案后 12–24 个月 |

### 3.6 儿童年龄（GDPR Art.8）【未核实原文，属常识】
- GDPR Art.8 对基于同意的信息社会服务规定 16 岁门槛，成员国可下调至 13 岁；UK GDPR 为 13 岁。本站若面向 EU 用户并以同意为基础（广告 Cookie），需与第 4 节 COPPA 年龄门槛一起设计（建议统一 ≥16 或直接 18+，见第 4 节推断）。

---

## 4. 美国层面：COPPA、CCPA/CPRA、Do Not Sell/Share 与 AdSense

### 4.1 COPPA（13 岁以下）
- FTC COPPA FAQ 来源：https://www.ftc.gov/business-guidance/resources/complying-coppa-frequently-asked-questions （访问日期 2026-10-04）
- **【官方原文】** 一般受众网站适用条件：操作者 "actual knowledge that they are collecting, using, or disclosing personal information from children under 13"（FAQ B.1/A.2）。
- **【官方原文】** 年龄筛选须中立：可 "freely to enter the month and year of birth"；不得用仅限 13+ 的下拉菜单、"I am over 12" 勾选框等暗示；建议用 Cookie 防止用户返回重填年龄（FAQ D.7/H.3）。
- **【官方原文】** 个人信息含 "a persistent identifier that can be used to recognize a user over time and across different websites or online services"（Cookie 中的客户号、IP、设备 ID）（FAQ A.3）。
- **【官方原文】** 面向儿童网站对第三方广告网络的收集负责："responsible for the collection of personal information from your users, no matter who is doing the collection"（FAQ D.10）。
- **【官方原文】** "The COPPA Rule was amended on April 22, 2025."
- 16 CFR 312.2 来源：https://www.law.cornell.edu/cfr/text/16/312.2 （访问日期 2026-10-04）—— **【官方原文】** "A mixed audience website or online service shall not be deemed directed to children with regard to any visitor not identified as under 13."
- 16 CFR 312.10 来源：https://www.law.cornell.edu/cfr/text/16/312.10 （访问日期 2026-10-04）—— **【官方原文】** 须 "establish, implement, and maintain a written data retention policy that sets forth the purposes for which children's personal information is collected, the business need for retaining such information, and a timeframe for deletion"。
- FTC 2025 修订新闻稿来源：https://www.ftc.gov/news-events/news/press-releases/2025/01/ftc-finalizes-changes-childrens-privacy-rule-limiting-companies-ability-monetize-kids-data （访问日期 2026-10-04）—— **【官方原文】** "Requiring opt-in consent for targeted advertising and other disclosures to third parties"、"separate verifiable parental consent to disclose children's personal information to third-party companies"、不得无限期保留。二手来源（律所综述，WebSearch）称大部分实质性要求的合规截止日为 **2026-04-22**，即**已经生效**。【截止日未在 FTC 原文直接核实】
- **【推断】对本站影响与年龄门槛**：
  1. 本站是一般受众站（占星/命理不以儿童为目标），正常情况下不受 COPPA 约束，**但**本站**必然采集出生日期**——一旦用户在表单中输入的生日对应 <13 岁，你就取得「实际知情」。因此必须：注册/测算流程中若出生日期算出年龄 <13，**立即阻断**（不创建账户、不落库、不投广告标签），并用会话 Cookie 防止回退重填。
  2. 对「为他人（如孩子）排盘」功能：这是关于第三方的数据，不是从儿童本人收集，COPPA 风险低，但 GDPR 下仍是处理第三方个人数据，建议在 UI 提示「仅在取得当事人同意的情况下输入他人资料」。
  3. 建议把服务条款的使用年龄定为 **18+**（与 App Store 同类产品 18+ 分级一致，也避开 GDPR 13–16 岁灰区），并在注册时做中立年龄门槛（出生年月自由输入）。

### 4.2 CCPA/CPRA 适用门槛
- 来源：https://oag.ca.gov/privacy/ccpa （访问日期 2026-10-04）
- **【官方原文】** 适用于满足任一条件的营利企业："Have a gross annual revenue of over $25 million"；"Buy, sell, or share the personal information of 100,000 or more California residents or households"；"Derive 50% or more of their annual revenue from selling California residents' personal information"。（注：CPPA 已按 CPI 将收入门槛上调至约 $26.6M，此为我的既有知识，未在本次核实。）
- **【官方原文】** "Share" 指 "sharing for cross-context behavioral advertising, which is the targeting of advertising to a consumer based on the consumer's personal information obtained from the consumer's online activity across numerous websites"。
- **【官方原文】** 出售/共享个人信息的企业须提供 "a clear and conspicuous 'Do Not Sell or Share My Personal Information' link on their website"，且不得要求创建账户；须把 Global Privacy Control 信号 "honored by covered businesses as a valid consumer request"。

### 4.3 【推断】Do Not Sell/Share 与 AdSense 的关系
- AdSense 个性化广告 = 把 Cookie/设备标识等传给 Google 用于跨站行为广告 → 在 CPRA 定义下属于 **"share"**（Google 自己也在 RDP 页面说明：2023-07-01 起在加州对跨情境行为广告 Google 不再以 service provider 身份处理）。
- 早期站点很可能**不达**三条门槛（收入 <$25M，加州用户 <10 万），严格来说 CCPA 不适用。但：
  1. 10 万加州「消费者或家庭」包括仅被 Cookie 识别的访客，流量起来后很快达标；
  2. 其它 19 个州的综合隐私法门槛各异（多为 10 万州内消费者，或 2.5 万 + 25% 收入来自卖数据）；
  3. 启用 AdSense 的 US state regulations message 几乎零成本。
  → 建议从上线第一天在页脚放 "Do Not Sell or Share My Personal Information / 请勿出售或共享我的个人信息" 链接（直接调用 AdSense 的消息），账户级开启 RDP 对 GPC 信号的响应，隐私政策加「加州居民权利」章节（知情/删除/更正/退出出售或共享/限制敏感信息使用/不受歧视）。
  4. CPRA 下「敏感个人信息」含「宗教或哲学信仰」「精确地理位置」等；出生地（城市级）通常不是精确地理位置，但不要采集 GPS 精确坐标。

---

## 5. 占卜类网站免责声明范本（英文 + 中文）

### 5.1 英文范本（公开可访问）
1. **My Astro Diaries（Substack）Terms** — https://myastrodiaries.substack.com/tos （访问日期 2026-10-04）
   - 原文："All astrology readings, reports, forecasts, and other digital content provided on this website are for entertainment, educational, and spiritual guidance purposes only."；"it does not constitute medical, legal, financial, or professional advice"；"You are solely responsible for any decisions or actions you take based on the information provided."；"No guarantees are made regarding accuracy, outcomes, or results."
2. **r-astro.com Disclaimer** — https://r-astro.com/disclaimer （访问日期 2026-10-04）
   - 原文："...is provided for educational, cultural, and spiritual reference. It is not a substitute for professional advice, whether legal, medical, financial, psychological, or otherwise."；"Predictions, horoscope interpretations, and remedies are based on traditional texts and may not reflect modern scientific consensus."；"r-astro disclaims all liability for outcomes arising from use or reliance on the information provided. Use this service at your own discretion and responsibility."
3. **OnlineJyotish Disclaimer** — https://www.onlinejyotish.com/disclaimer.php （访问日期 2026-10-04，页面返回 403，内容来自搜索摘要）："Vedic astrology services are provided for informational, educational, spiritual guidance, and entertainment purposes only and are NOT a substitute for professional medical, legal, financial, or psychological advice."
4. 监管参考：**UK ASA/CAP 对 psychics/astrologers 的广告指引** — https://www.asa.org.uk/advice-online/psychics-spiritualists-fortune-tellers-astrologers-and-clairvoyants.html （访问日期 2026-10-04）—— **【官方原文】** "Ads should not mislead or exploit vulnerable people. Marketers should neither make promises they cannot keep, such as promising to break curses or improve health, wealth or other circumstances, or exploit the credulity of naive or susceptible people."；"Claims of 'help offered' should generally be replaced with 'advice'..."（CAP Code 1.3、3.1）。

### 5.2 中文范本
1. **Astroscope（App Store 中国/澳门区描述）** — https://apps.apple.com/cn/app/astroscope-%E6%98%9F%E5%BA%A7%E8%BF%90%E5%8A%BF%E4%B8%8E%E5%A1%94%E7%BD%97/id1659088177 （访问日期 2026-10-04）—— 原文："Astroscope 内容仅供娱乐参考"。
2. **My Zodiac AI 繁中服务条款** — https://my-zodiac-ai.com/zh-TW/terms （访问日期 2026-10-04，直接抓取 403；搜索摘要显示其为 AI 占星服务条款，含娱乐参考性质声明）【未核实原文】
3. 本次搜索显示中文命理站多数只在 App 描述里写「仅供娱乐参考」，完整条款多需登录应用内查看。**【推断】建议直接采用下方双语范本**（综合上述英文范本 + ASA 指引精神起草）：

> **免责声明 / Disclaimer**
> 本网站提供的占星、塔罗、八字、紫微斗数、风水等所有内容（包括由人工智能生成的解读）仅供娱乐、文化学习与自我反思之用，不构成也不应被视为医疗、心理、法律、财务、投资或其他专业建议。我们不对任何预测、解读的准确性、完整性或结果作出保证。您基于本网站内容所作的任何决定及其后果，均由您自行承担。如涉及健康、法律、财务或心理问题，请咨询具备资质的专业人士。本服务仅面向 18 岁及以上用户。
> All astrology, tarot, BaZi, Zi Wei, feng shui and other content on this site (including AI-generated interpretations) is provided for entertainment, cultural and self-reflection purposes only. It does not constitute, and should not be relied upon as, medical, psychological, legal, financial, investment or any other professional advice. We make no guarantee as to the accuracy, completeness or outcome of any reading. Any decision you make based on this content is your sole responsibility. For health, legal, financial or mental-health matters, please consult a qualified professional. This service is intended for users aged 18 and over.

---

## 6. 支付：Stripe / Paddle / Lemon Squeezy 对占星/算命类商家的态度

### 6.1 Stripe
- 来源：https://stripe.com/legal/restricted-businesses （访问日期 2026-10-04；页面标注 Last updated 2026-09-22）
- **【官方原文】** 全球 "Prohibited Businesses" 与 "Restricted Businesses" 清单中**没有** astrology / horoscope / tarot / psychic / fortune telling 条目。
- **【官方原文】** 仅在 "Jurisdiction-specific Prohibited Businesses" 中出现：日本 — "Psychic services and fortune tellers"；墨西哥 — "Psychic services and fortune tellers"；泰国 — "Psychic services and fortune tellers"。
- **【官方原文】** 全球禁止项（Unfair, deceptive or abusive acts or practices）："'Get rich quick' schemes, including investment opportunities or other services that promise high rewards to mislead consumers"、"schemes that claim to offer high rewards for very little effort or up-front work"。
- **【推断】** 以美国/加拿大/澳洲/英国/欧盟实体注册 Stripe 账户销售「去广告订阅」属允许业务，无额外前置条件；需避免：承诺改运/发财/复合的营销语、以「化解灾祸」为名的高价附加付费（易触发 deceptive practices 与高拒付率风控）。保留第 5 节免责声明、清晰的订阅取消流程可降低 Stripe 风控/拒付风险。若未来注册日本/墨西哥/泰国本地 Stripe 账户则属禁止。

### 6.2 Paddle（Merchant of Record）
- 来源：https://paddle.com/support/aup （访问日期 2026-10-04；标注 Last updated 13 April 2026）及 https://paddle.com/help/start/intro-to-paddle/what-am-i-not-allowed-to-sell-on-paddle
- **【官方原文】** 禁止类别第 14 项："Digital services associated with pseudo-science, including but not limited to clairvoyance, horoscopes, fortune-telling"。另：第 15 项 Medical advice services；"Paddle is built to serve software companies (including B2B SaaS, Consumer Software, and Games)."
- **【推断】** Paddle **明确不可用**于本项目，不必作为备选。

### 6.3 Lemon Squeezy（Merchant of Record）
- 来源：https://docs.lemonsqueezy.com/help/getting-started/prohibited-products 与 https://www.lemonsqueezy.com/terms （访问日期 2026-10-04）
- **【官方原文】** 禁止："Regulated products such as: CBD, gambling, weapons, ammunition, pay to play auctions, sweepstakes, lotteries, donations, business-in-a-box, work-from-home, get-rich-quick schemes, etc."；另有 Multi-level marketing、timeshares、pharmaceuticals、essay mills、legal services、debt relief 等。
- **【官方原文】** 清单**未**提及 psychic / fortune telling / astrology / tarot。文档建议不确定时先联系支持。
- **【推断】** Lemon Squeezy 为可行备选（MoR 模式自动处理全球销售税/VAT，对海外华人多国用户友好）。上线前建议邮件向其支持确认「astrology/tarot content subscription, entertainment purposes」是否接受并留存回复。Lemon Squeezy 已被 Stripe 收购（2024），风控口径可能逐步与 Stripe 趋同【此为既有知识，未在本次核实】。
- 其他备选（未核实）：FastSpring、Gumroad、Polar.sh —— 需逐一查其 AUP。

---

## 7. Google OAuth 登录：隐私政策与应用验证要求

- OAuth 验证总览：https://support.google.com/cloud/answer/13463073 与 https://support.google.com/cloud/answer/9110914 （访问日期 2026-10-04）
  - **【官方原文】** "Apps that request access to scopes categorized as sensitive or restricted must complete Google's OAuth app verification before being granted access."；三类 scope："non-sensitive"、"sensitive"、"restricted"；"Apps requesting restricted scopes data need to complete 're-verification' annually."；仅非敏感 scope 的应用可做 "brand-verification" 以展示名称与 Logo。
- Consent screen 设置：https://support.google.com/cloud/answer/10311615 （访问日期 2026-10-04）
  - **【官方原文】** App name 须 "distinctively represent your business"；App logo "square and 120px by 120px"、<1MB；App domain/homepage 须 "hosted on a verified domain you own" 并 "accurately represent and identify your app or brand"；**Privacy policy** 须 "hosted within the domain that hosts your homepage"、"linked on your homepage"、"disclose how your app accesses, uses, stores, and/or shares Google user data"；Terms of Service 链接对外部生产应用为必填；"All domains used in your project...must be pre-registered" 于 Authorized domains。
- 发布状态与测试用户：https://support.google.com/cloud/answer/15549945 （访问日期 2026-10-04）
  - **【官方原文】** "Projects configured with a publishing status of Testing are limited to up to 100 test users"；"Authorizations by a test user will expire seven days from the time of consent."；In production 状态 "available to any user with a Google Account"；外部生产应用请求敏感 scope 会显示 "Unverified apps warning"；仅请求 name/email/profile（openid/email/profile）的应用："users do not need to be in the trusted user list, they will not see a warning message, and their authorizations will not expire."
- OpenID Connect scopes：https://developers.google.com/identity/openid-connect/openid-connect （访问日期 2026-10-04）—— **【官方原文】** `openid`（必需）、`email`（返回 email、email_verified）、`profile`（可能返回 name、family_name、given_name、picture、locale）。
- **【推断】本项目配置清单**：
  1. 只申请 `openid email profile` → 非敏感，无需 OAuth 安全验证；想在同意屏显示品牌名与 Logo 则做 brand verification（需 Search Console 验证域名）。
  2. 隐私政策页必须放在主站域名下（如 destinyos.com/privacy），并从首页页脚可达；其中明确「我们从 Google 获取您的姓名、邮箱、头像用于创建账户；不会向第三方出售」。
  3. 上线前把 OAuth consent screen 从 Testing 切到 In production，否则 100 人上限、7 天过期。
  4. 不要申请 Calendar/Contacts/Gmail 等敏感 scope（即使想做「生日提醒」也建议改为站内通知），否则进入年审与安全评估流程。

---

## 8. Vercel / Cloudflare 服务条款

### 8.1 Vercel
- Terms of Service：https://vercel.com/legal/terms （访问日期 2026-10-04；Last updated June 1, 2026）—— **【官方原文】** 用户内容不得 "defamatory, obscene, unlawful, threatening, abusive, tortious, offensive or harassing"；须遵守 Acceptable Use Policy。
- Acceptable Use Policy：https://vercel.com/legal/acceptable-use-policy （访问日期 2026-10-04；Last updated April 21, 2026）—— **【官方原文】** 禁止 "Fraud, deceptive practices, or other scams"、"Impersonation, phishing, or misrepresenting authorization"、"Sale, promotion or facilitation of illegal goods and services"、clickbait/clickfraud 等；对 AI 服务另有限制（不得作为 "a substitute for regulated advice"、不得处理 HIPAA 健康信息等）。无占星/算命条目。
- Fair Use Guidelines：https://vercel.com/docs/limits/fair-use-guidelines （访问日期 2026-10-04）—— **【官方原文】** "Hobby teams are restricted to non-commercial personal use only. All commercial usage of the platform requires either a Pro or Enterprise plan."；商业用途示例含 "Any method of requesting or processing payment from visitors of the site" 与 "The inclusion of advertisements, including but not limited to online advertising platforms like Google AdSense"。
- **【推断】** 内容层面无风险；**运营层面必须用 Pro 计划**（AdSense + Stripe 都是明示的商业用途）。若用 Vercel AI SDK/AI Gateway 生成解读，注意 AUP 中「不得作为受监管建议替代品」——与第 5 节免责声明一致即可。

### 8.2 Cloudflare
- Self-Serve Subscription Agreement：https://www.cloudflare.com/terms/ （访问日期 2026-10-04；Last updated September 12, 2025）—— **【官方原文】** §2.7 Acceptable Use：不得 "post, transmit, store or link to any files... that infringe on any person's intellectual property rights or that are otherwise unlawful"、"facilitate phishing, spamming, or other technical abuse"、"engage in any activities that are illegal, including disseminating, promoting or facilitating child sexual exploitation and abuse or human trafficking"；§2.2.1 禁止用服务提供 VPN/代理等。
- Website Terms of Use：https://www.cloudflare.com/website-terms/ （访问日期 2026-10-04）—— 同样仅针对非法、侵权、恶意软件、欺诈类内容。
- **【推断】** Cloudflare（DNS/CDN/Pages/Workers/R2）对占星、塔罗、命理内容无任何限制；需注意 Workers/Pages 的 Service-Specific Terms（本次未逐条核实）。

---

## 9. 「天机」/「DestinyOS」商标初步检索（非法律结论）

### 9.1 检索限制说明
- USPTO 官方检索系统 https://tmsearch.uspto.gov/ 为 JS 应用，本次工具无法抓取；Justia Trademarks、TrademarkElite、uspto.report 均返回 403。以下为搜索引擎可见的二手记录，**务必**在 USPTO 官方系统复检。
- 中国商标网 https://sbj.cnipa.gov.cn/ 需验证码/交互，本次无法抓取；以下来自百度百科与知夫子等第三方页面的搜索摘要。

### 9.2 DestinyOS（美国）
- 搜索「"DestinyOS" trademark USPTO」与「"Destiny OS" trademark」（访问日期 2026-10-04）：**未发现**任何名为 DESTINYOS / DESTINY OS 的美国商标记录。
- 观察到的相关在先权利：
  1. **Bungie, Inc.** 持有大量 "DESTINY" 系列商标（视频游戏软件、娱乐服务，第 9/41 类），含 "DESTINY"、"THE TAKEN KING"、"EVERVERSE TRADING CO." 等。来源示例：https://gleanmark.com/trademark/uspto-74564078 ；https://www.patentarcade.com/2015/07/bungie-eververse-trademarks.html
  2. **Pattern Inc.** 于 2026-08-24 新申请 "DESTINY"（serial 50067654，审查中）。来源：https://trademarkregistration.app/Trademark/Details/50067654 【第三方镜像，未在 USPTO 核实】
- **【推断】** "DestinyOS" = DESTINY + 描述性后缀 "OS"。若在第 9 类（软件/App）或第 42 类（SaaS）申请，审查员可能以 Bungie 的 DESTINY（软件/娱乐）为引证提出混淆可能性（Section 2(d)）。占星服务在美国通常落在第 45 类（astrology/horoscope services）与第 41 类（娱乐/信息），与游戏类商品有一定区隔，但 App 本身仍在第 9 类。建议：以「DestinyOS」为品牌时同时申请第 9、42、45 类，并先做付费全面检索；或考虑更具区分度的组合（如 "DestinyOS Tianji"）。

### 9.3 天机（中国）
- 搜索摘要显示（百度百科 https://baike.baidu.com/item/%E5%A4%A9%E6%9C%BA/23620262 ，访问日期 2026-10-04，直接抓取 403）：「天机」由**北京融世纪信息技术有限公司**注册，申请/注册号 **24016181A**，申请日 2017-05-08，**第 45 类**，注册公告日 2019-03-14。【来自搜索摘要，未直接核实原页】
- 中国《类似商品和服务区分表》第 45 类 4505 群组包含「占星术服务」「算命」等服务项目【此为既有知识，建议在 https://sbj.cnipa.gov.cn/sbj/sbsq/sphfwfl/ 复核】。
- 另有 **河南天机文化发展集团有限公司** 在第 41 类（教育娱乐）持有「做标」(45048687)、「天佐」(44065975) 等商标，表明「天机文化」是一家已存在的文化类公司。来源：https://m.zhifuzi.com/Rchaxun/070D6F28B3EFCC1DED6D182512F52A81.html ；https://m.zhifuzi.com/Rchaxun/77801826D71C81CEA4BB2FE68D8949EC.html
- 市场上已有多款含「天机」的命理 App：「文墨天机」「天机六爻排盘」「测天机」「天机八字排盘」（腾讯应用宝/App Store 可见，如 https://sj.qq.com/appdetail/com.tianjice 、https://apps.apple.com/cn/app/id1385505110 ）。
- **【推断】**
  1. 「天机」在第 45 类（占卜/算命服务所在类）**已有在先注册**，在第 41/42/9 类亦大概率有多件近似在先申请；作为中国商标在命理品类注册**冲突风险高**。
  2. 「天机」在命理语境中是行业常用词（「天机不可泄露」），即便无冲突也可能被认定缺乏显著性（《商标法》第 11 条）。
  3. 若主要市场在海外，可在美国以拼音/英文（"TIANJI"、"TIANJI DESTINYOS"）申请；本次检索美国 "TIANJI" 仅见服装类 "TIANJIE"、鞋类 "TIANJIMOJ"、被放弃的 "TIANJIN"（电器类）等不相关记录（来源：https://trademark.justia.com/905/94/tianjie-90594412.html 等），未见占星/软件类 "TIANJI"。
  4. 建议：在 USPTO TESS/新系统、WIPO Global Brand Database、中国商标网分别做正式检索；中文名可考虑使用更具独创性的组合词或在「天机」前后加品牌元素并以图形商标申请。

---

## 附：待办清单（综合推断）
1. 全站（中英）加免责声明 + 18+ 使用条款；AI 解读页面逐条附注「仅供娱乐参考」。
2. 注册流程：中立年龄门槛（出生年月自由输入）；<13 岁阻断且不落库；会话 Cookie 防重填。
3. 隐私政策（中英一致）按 Art.13 全部要素 + 加州居民权利 + Google 用户数据使用说明 + 保留期表 + 国际传输说明；托管在主域并从首页链接。
4. AdSense：开启 Privacy & messaging 的 European regulations message 与 US state regulations message；账户级 RDP + GPC；页脚 "Do Not Sell or Share" 链接；屏蔽「Astrology and esoteric」广告类别与否按商业判断（即将下线）。
5. 内容红线：不做健康/疾病预测，不承诺财运/复合/改运结果，不售卖「化解」类高价服务。
6. 支付：Stripe 主用；Lemon Squeezy 备选（先邮件确认）；排除 Paddle。
7. Google OAuth：仅 openid/email/profile；切 In production；做 brand verification。
8. 托管：Vercel Pro（非 Hobby）；Cloudflare 无限制。
9. 商标：对「DestinyOS」「天机」各做一次正式检索后再定名；暂避免在中国以「天机」单独申请命理类商标。

> 本报告为合规调研整理，不构成法律意见；涉及 GDPR 代表、CCPA 适用判断、商标注册策略，建议在上线前咨询相应司法辖区的律师。
