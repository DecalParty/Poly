exports.id=558,exports.ids=[558],exports.modules={21150:()=>{},38054:(e,t,a)=>{"use strict";a.d(t,{db:()=>w,jO:()=>b,Bw:()=>O,fK:()=>n});var n={};a.r(n),a.d(n,{dailyStats:()=>N,marketPerformance:()=>p,settings:()=>T,trades:()=>u});var s=a(58757),i=a(92048),l=a(55315),o=a(87106),r=a(5795),L=a(53586),d=a(54341),E=a(20449);let u=(0,o.Px)("trades",{id:(0,r._L)("id").primaryKey({autoIncrement:!0}),timestamp:(0,L.fL)("timestamp").notNull(),conditionId:(0,L.fL)("condition_id").notNull(),slug:(0,L.fL)("slug").notNull(),side:(0,L.fL)("side",{enum:["yes","no"]}).notNull(),action:(0,L.fL)("action",{enum:["buy","sell","resolution"]}).notNull(),price:(0,d.kw)("price").notNull(),amount:(0,d.kw)("amount").notNull(),shares:(0,d.kw)("shares").notNull(),pnl:(0,d.kw)("pnl"),paper:(0,r._L)("paper",{mode:"boolean"}).notNull().default(!0),orderId:(0,L.fL)("order_id"),asset:(0,L.fL)("asset"),subStrategy:(0,L.fL)("sub_strategy"),binancePriceAtEntry:(0,d.kw)("binance_price_at_entry"),slippage:(0,d.kw)("slippage"),takerFee:(0,d.kw)("taker_fee")}),T=(0,o.Px)("settings",{id:(0,r._L)("id").primaryKey().default(1),buyAmount:(0,d.kw)("buy_amount").notNull().default(.1),buyIntervalSeconds:(0,r._L)("buy_interval_seconds").notNull().default(5),entryPriceMin:(0,d.kw)("entry_price_min").notNull().default(.9),entryPriceMax:(0,d.kw)("entry_price_max").notNull().default(.95),stopLossThreshold:(0,d.kw)("stop_loss_threshold").notNull().default(.5),maxMinutesRemaining:(0,r._L)("max_minutes_remaining").notNull().default(8),maxPositionSize:(0,d.kw)("max_position_size").notNull().default(5),paperTrading:(0,r._L)("paper_trading",{mode:"boolean"}).notNull().default(!0),totalBankroll:(0,d.kw)("total_bankroll").notNull().default(50),maxTotalExposure:(0,d.kw)("max_total_exposure").notNull().default(30),reserveAmount:(0,d.kw)("reserve_amount").notNull().default(20),perWindowMax:(0,d.kw)("per_window_max").notNull().default(8),maxSimultaneousPositions:(0,r._L)("max_simultaneous_positions").notNull().default(3),dailyLossLimit:(0,d.kw)("daily_loss_limit").notNull().default(10),consecutiveLossLimit:(0,r._L)("consecutive_loss_limit").notNull().default(5),enabledAssets:(0,L.fL)("enabled_assets").notNull().default('["BTC"]'),momentumMinPriceChange:(0,d.kw)("momentum_min_price_change").notNull().default(.001),momentumEntryMin:(0,d.kw)("momentum_entry_min").notNull().default(.6),momentumEntryMax:(0,d.kw)("momentum_entry_max").notNull().default(.93),momentumTimeMin:(0,r._L)("momentum_time_min").notNull().default(120),momentumTimeMax:(0,r._L)("momentum_time_max").notNull().default(480),momentumEnabled:(0,r._L)("momentum_enabled",{mode:"boolean"}).notNull().default(!0),highConfEntryMin:(0,d.kw)("high_conf_entry_min").notNull().default(.88),highConfEntryMax:(0,d.kw)("high_conf_entry_max").notNull().default(.96),highConfTimeMin:(0,r._L)("high_conf_time_min").notNull().default(60),highConfTimeMax:(0,r._L)("high_conf_time_max").notNull().default(480),highConfEnabled:(0,r._L)("high_conf_enabled",{mode:"boolean"}).notNull().default(!0),highConfBuyAmount:(0,d.kw)("high_conf_buy_amount").notNull().default(.1),highConfBuyInterval:(0,r._L)("high_conf_buy_interval").notNull().default(5),highConfStopLoss:(0,d.kw)("high_conf_stop_loss").notNull().default(.79),arbitrageEnabled:(0,r._L)("arbitrage_enabled",{mode:"boolean"}).notNull().default(!0),arbMaxPerWindow:(0,d.kw)("arb_max_per_window").notNull().default(10),arbBudgetUp:(0,d.kw)("arb_budget_up"),arbBudgetDown:(0,d.kw)("arb_budget_down"),arbLadderLevels:(0,L.fL)("arb_ladder_levels").notNull().default('[{"price":0.48,"allocation":0.40},{"price":0.46,"allocation":0.35},{"price":0.44,"allocation":0.25}]'),maxCombinedCost:(0,d.kw)("max_combined_cost").notNull().default(.97),arbCancelBeforeEnd:(0,r._L)("arb_cancel_before_end").notNull().default(120),arbMarket:(0,L.fL)("arb_market").notNull().default("BTC"),scalpEnabled:(0,r._L)("scalp_enabled",{mode:"boolean"}).notNull().default(!0),scalpTradeSize:(0,d.kw)("scalp_trade_size").notNull().default(12),scalpMaxPositions:(0,r._L)("scalp_max_positions").notNull().default(2),scalpMinGap:(0,d.kw)("scalp_min_gap").notNull().default(.08),scalpProfitTarget:(0,d.kw)("scalp_profit_target").notNull().default(.07),scalpEntryMin:(0,d.kw)("scalp_entry_min").notNull().default(.4),scalpEntryMax:(0,d.kw)("scalp_entry_max").notNull().default(.7),scalpCooldownWindows:(0,r._L)("scalp_cooldown_windows").notNull().default(1),scalpExitWindow:(0,r._L)("scalp_exit_window").notNull().default(120),betAmount:(0,d.kw)("bet_amount").notNull().default(2)}),N=(0,o.Px)("daily_stats",{date:(0,L.fL)("date").primaryKey(),totalTrades:(0,r._L)("total_trades").notNull().default(0),wins:(0,r._L)("wins").notNull().default(0),losses:(0,r._L)("losses").notNull().default(0),pnl:(0,d.kw)("pnl").notNull().default(0),feesSpent:(0,d.kw)("fees_spent").notNull().default(0),arbitrageTrades:(0,r._L)("arbitrage_trades").notNull().default(0),momentumTrades:(0,r._L)("momentum_trades").notNull().default(0),highConfTrades:(0,r._L)("high_conf_trades").notNull().default(0),circuitBreakerTriggered:(0,r._L)("circuit_breaker_triggered").notNull().default(0)}),p=(0,o.Px)("market_performance",{asset:(0,L.fL)("asset").notNull(),date:(0,L.fL)("date").notNull(),trades:(0,r._L)("trades").notNull().default(0),wins:(0,r._L)("wins").notNull().default(0),losses:(0,r._L)("losses").notNull().default(0),pnl:(0,d.kw)("pnl").notNull().default(0)},e=>({pk:(0,E.CK)({columns:[e.asset,e.date]})})),m=(0,l.join)(process.cwd(),"data"),_=(0,l.join)(m,"trades.db");(0,i.existsSync)(m)||(0,i.mkdirSync)(m,{recursive:!0});let c=null;function g(){if(c)return c;throw Error("Database not initialized - call ensureDb() first")}function f(){let e=g().export();(0,i.writeFileSync)(_,Buffer.from(e))}class U{constructor(e){this.isRaw=!1,this.sql=e}raw(e=!0){return this.isRaw=e,this}bind(){return this}run(...e){let t=g(),a=1===e.length&&Array.isArray(e[0])?e[0]:e;return t.run(this.sql,a),f(),{changes:t.getRowsModified(),lastInsertRowid:0}}get(...e){let t=g(),a=1===e.length&&Array.isArray(e[0])?e[0]:e,n=t.prepare(this.sql);if(a.length>0&&n.bind(a),n.step()){if(this.isRaw){let e=n.get();return n.free(),e}let e=n.getColumnNames(),t=n.get(),a={};return e.forEach((e,n)=>a[e]=t[n]),n.free(),a}n.free()}all(...e){let t=g(),a=1===e.length&&Array.isArray(e[0])?e[0]:e,n=[],s=t.prepare(this.sql);for(a.length>0&&s.bind(a);s.step();)if(this.isRaw)n.push(s.get());else{let e=s.getColumnNames(),t=s.get(),a={};e.forEach((e,n)=>a[e]=t[n]),n.push(a)}return s.free(),n}}let h={prepare:e=>new U(e),exec(e){g().run(e),f()},pragma(e){},transaction:e=>()=>{g().run("BEGIN");try{let t=e();return g().run("COMMIT"),f(),t}catch(e){throw g().run("ROLLBACK"),e}}},A=null;function b(){return c?Promise.resolve():A||(A=(async()=>{let e=a(80470),t=await e();if((0,i.existsSync)(_)){let e=(0,i.readFileSync)(_);c=new t.Database(e)}else c=new t.Database;c.run(`
      CREATE TABLE IF NOT EXISTS trades (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT NOT NULL,
        condition_id TEXT NOT NULL,
        slug TEXT NOT NULL,
        side TEXT NOT NULL CHECK(side IN ('yes', 'no')),
        action TEXT NOT NULL CHECK(action IN ('buy', 'sell', 'resolution')),
        price REAL NOT NULL,
        amount REAL NOT NULL,
        shares REAL NOT NULL,
        pnl REAL,
        paper INTEGER NOT NULL DEFAULT 1,
        order_id TEXT,
        asset TEXT,
        sub_strategy TEXT,
        binance_price_at_entry REAL,
        slippage REAL,
        taker_fee REAL
      )
    `),c.run(`
      CREATE TABLE IF NOT EXISTS settings (
        id INTEGER PRIMARY KEY DEFAULT 1,
        buy_amount REAL NOT NULL DEFAULT 0.10,
        buy_interval_seconds INTEGER NOT NULL DEFAULT 5,
        entry_price_min REAL NOT NULL DEFAULT 0.90,
        entry_price_max REAL NOT NULL DEFAULT 0.95,
        stop_loss_threshold REAL NOT NULL DEFAULT 0.50,
        max_minutes_remaining INTEGER NOT NULL DEFAULT 8,
        max_position_size REAL NOT NULL DEFAULT 5.00,
        paper_trading INTEGER NOT NULL DEFAULT 1,
        total_bankroll REAL NOT NULL DEFAULT 50,
        max_total_exposure REAL NOT NULL DEFAULT 30,
        reserve_amount REAL NOT NULL DEFAULT 20,
        per_window_max REAL NOT NULL DEFAULT 8,
        max_simultaneous_positions INTEGER NOT NULL DEFAULT 3,
        daily_loss_limit REAL NOT NULL DEFAULT 10,
        consecutive_loss_limit INTEGER NOT NULL DEFAULT 5,
        enabled_assets TEXT NOT NULL DEFAULT '["BTC"]',
        momentum_min_price_change REAL NOT NULL DEFAULT 0.001,
        momentum_entry_min REAL NOT NULL DEFAULT 0.60,
        momentum_entry_max REAL NOT NULL DEFAULT 0.93,
        momentum_time_min INTEGER NOT NULL DEFAULT 120,
        momentum_time_max INTEGER NOT NULL DEFAULT 480,
        momentum_enabled INTEGER NOT NULL DEFAULT 1,
        high_conf_entry_min REAL NOT NULL DEFAULT 0.90,
        high_conf_entry_max REAL NOT NULL DEFAULT 0.95,
        high_conf_time_min INTEGER NOT NULL DEFAULT 30,
        high_conf_time_max INTEGER NOT NULL DEFAULT 480,
        high_conf_enabled INTEGER NOT NULL DEFAULT 1,
        high_conf_buy_amount REAL NOT NULL DEFAULT 0.10,
        high_conf_buy_interval INTEGER NOT NULL DEFAULT 5,
        high_conf_stop_loss REAL NOT NULL DEFAULT 0.79,
        max_combined_cost REAL NOT NULL DEFAULT 0.97,
        arbitrage_enabled INTEGER NOT NULL DEFAULT 1,
        arb_max_per_window REAL NOT NULL DEFAULT 10,
        arb_budget_up REAL,
        arb_budget_down REAL,
        arb_ladder_levels TEXT NOT NULL DEFAULT '[{"price":0.48,"allocation":0.40},{"price":0.46,"allocation":0.35},{"price":0.44,"allocation":0.25}]',
        arb_cancel_before_end INTEGER NOT NULL DEFAULT 120,
        arb_market TEXT NOT NULL DEFAULT 'BTC',
        bet_amount REAL NOT NULL DEFAULT 2.00
      )
    `),c.run(`
      CREATE TABLE IF NOT EXISTS daily_stats (
        date TEXT PRIMARY KEY,
        total_trades INTEGER NOT NULL DEFAULT 0,
        wins INTEGER NOT NULL DEFAULT 0,
        losses INTEGER NOT NULL DEFAULT 0,
        pnl REAL NOT NULL DEFAULT 0,
        fees_spent REAL NOT NULL DEFAULT 0,
        arbitrage_trades INTEGER NOT NULL DEFAULT 0,
        momentum_trades INTEGER NOT NULL DEFAULT 0,
        high_conf_trades INTEGER NOT NULL DEFAULT 0,
        circuit_breaker_triggered INTEGER NOT NULL DEFAULT 0
      )
    `),c.run(`
      CREATE TABLE IF NOT EXISTS market_performance (
        asset TEXT NOT NULL,
        date TEXT NOT NULL,
        trades INTEGER NOT NULL DEFAULT 0,
        wins INTEGER NOT NULL DEFAULT 0,
        losses INTEGER NOT NULL DEFAULT 0,
        pnl REAL NOT NULL DEFAULT 0,
        PRIMARY KEY (asset, date)
      )
    `);let n=(e,t,a)=>{try{c.run(`ALTER TABLE ${e} ADD COLUMN ${t} ${a}`)}catch{}};n("trades","asset","TEXT"),n("trades","sub_strategy","TEXT"),n("trades","binance_price_at_entry","REAL"),n("trades","slippage","REAL"),n("trades","taker_fee","REAL"),n("settings","total_bankroll","REAL NOT NULL DEFAULT 50"),n("settings","max_total_exposure","REAL NOT NULL DEFAULT 30"),n("settings","reserve_amount","REAL NOT NULL DEFAULT 20"),n("settings","per_window_max","REAL NOT NULL DEFAULT 8"),n("settings","max_simultaneous_positions","INTEGER NOT NULL DEFAULT 3"),n("settings","daily_loss_limit","REAL NOT NULL DEFAULT 10"),n("settings","consecutive_loss_limit","INTEGER NOT NULL DEFAULT 5"),n("settings","enabled_assets","TEXT NOT NULL DEFAULT '[\"BTC\"]'"),n("settings","momentum_min_price_change","REAL NOT NULL DEFAULT 0.001"),n("settings","momentum_entry_min","REAL NOT NULL DEFAULT 0.60"),n("settings","momentum_entry_max","REAL NOT NULL DEFAULT 0.93"),n("settings","momentum_time_min","INTEGER NOT NULL DEFAULT 120"),n("settings","momentum_time_max","INTEGER NOT NULL DEFAULT 480"),n("settings","momentum_enabled","INTEGER NOT NULL DEFAULT 1"),n("settings","high_conf_entry_min","REAL NOT NULL DEFAULT 0.88"),n("settings","high_conf_entry_max","REAL NOT NULL DEFAULT 0.96"),n("settings","high_conf_time_min","INTEGER NOT NULL DEFAULT 60"),n("settings","high_conf_time_max","INTEGER NOT NULL DEFAULT 300"),n("settings","high_conf_enabled","INTEGER NOT NULL DEFAULT 1"),n("settings","high_conf_buy_amount","REAL NOT NULL DEFAULT 0.10"),n("settings","high_conf_buy_interval","INTEGER NOT NULL DEFAULT 5"),n("settings","high_conf_stop_loss","REAL NOT NULL DEFAULT 0.79"),n("settings","max_combined_cost","REAL NOT NULL DEFAULT 0.97"),n("settings","arbitrage_enabled","INTEGER NOT NULL DEFAULT 1"),n("settings","bet_amount","REAL NOT NULL DEFAULT 2.00"),n("settings","arb_max_per_window","REAL NOT NULL DEFAULT 10"),n("settings","arb_ladder_levels",'TEXT NOT NULL DEFAULT \'[{"price":0.48,"allocation":0.40},{"price":0.46,"allocation":0.35},{"price":0.44,"allocation":0.25}]\''),n("settings","arb_budget_up","REAL"),n("settings","arb_budget_down","REAL"),n("settings","arb_cancel_before_end","INTEGER NOT NULL DEFAULT 120"),n("settings","arb_market","TEXT NOT NULL DEFAULT 'BTC'"),n("settings","scalp_enabled","INTEGER NOT NULL DEFAULT 1"),n("settings","scalp_trade_size","REAL NOT NULL DEFAULT 12"),n("settings","scalp_max_positions","INTEGER NOT NULL DEFAULT 2"),n("settings","scalp_min_gap","REAL NOT NULL DEFAULT 0.08"),n("settings","scalp_profit_target","REAL NOT NULL DEFAULT 0.07"),n("settings","scalp_entry_min","REAL NOT NULL DEFAULT 0.40"),n("settings","scalp_entry_max","REAL NOT NULL DEFAULT 0.70"),n("settings","scalp_cooldown_windows","INTEGER NOT NULL DEFAULT 1"),c.run("INSERT OR IGNORE INTO settings (id) VALUES (1)"),f()})())}let w=(0,s.t)(h,{schema:n}),O=h},3412:(e,t,a)=>{"use strict";a.d(t,{UP:()=>f,vs:()=>p,NW:()=>d,Ql:()=>c,XJ:()=>g,sS:()=>m,xc:()=>_,Jl:()=>u,JU:()=>A,lv:()=>L,Gw:()=>U,uF:()=>N,_l:()=>T,yW:()=>E,Ei:()=>r,sE:()=>b,VP:()=>h});var n=a(31626),s=a(57745),i=a(81445),l=a(38054);let o={paperTrading:!0,totalBankroll:50,maxTotalExposure:30,perWindowMax:12,maxSimultaneousPositions:2,dailyLossLimit:10,lossLimit:5,enabledAssets:["BTC"],highConfEntryMin:.9,highConfEntryMax:.95,highConfTimeMin:30,highConfTimeMax:480,highConfEnabled:!1,highConfBuyAmount:.1,highConfBuyInterval:5,arbEnabled:!1,arbMaxPerWindow:10,arbBudgetUp:null,arbBudgetDown:null,arbLadderLevels:[{price:.48,allocation:.4},{price:.46,allocation:.35},{price:.44,allocation:.25}],arbMaxCombinedCost:.97,arbCancelBeforeEnd:120,arbMarket:"BTC",scalpEnabled:!0,scalpTradeSize:12,scalpMaxPositions:2,scalpMinGap:.08,scalpProfitTarget:.07,scalpEntryMin:.4,scalpEntryMax:.7,scalpCooldownWindows:1,scalpExitWindow:120};function r(e){var t;return{id:(t=l.db.insert(l.fK.trades).values({timestamp:e.timestamp,conditionId:e.conditionId,slug:e.slug,side:e.side,action:e.action,price:e.price,amount:e.amount,shares:e.shares,pnl:e.pnl,paper:e.paper,orderId:e.orderId,asset:e.asset,subStrategy:e.subStrategy,binancePriceAtEntry:e.binancePriceAtEntry,slippage:e.slippage,takerFee:e.takerFee}).returning().get()).id,timestamp:t.timestamp,conditionId:t.conditionId,slug:t.slug,side:t.side,action:t.action,price:t.price,amount:t.amount,shares:t.shares,pnl:t.pnl,paper:t.paper,orderId:t.orderId,asset:t.asset||null,subStrategy:t.subStrategy||null,binancePriceAtEntry:t.binancePriceAtEntry??null,slippage:t.slippage??null,takerFee:t.takerFee??null}}function L(e=50,t){let a="SELECT * FROM trades",n=[],s=[];return t?.asset&&(n.push("asset = ?"),s.push(t.asset)),t?.strategy&&(n.push("sub_strategy = ?"),s.push(t.strategy)),t?.from&&(n.push("timestamp >= ?"),s.push(t.from)),t?.to&&(n.push("timestamp <= ?"),s.push(t.to)),n.length>0&&(a+=" WHERE "+n.join(" AND ")),a+=" ORDER BY id DESC LIMIT ?",s.push(e),l.Bw.prepare(a).all(...s).map(e=>({id:e.id,timestamp:e.timestamp,conditionId:e.condition_id,slug:e.slug,side:e.side,action:e.action,price:e.price,amount:e.amount,shares:e.shares,pnl:e.pnl,paper:!!e.paper,orderId:e.order_id,asset:e.asset,subStrategy:e.sub_strategy,binancePriceAtEntry:e.binance_price_at_entry??null,slippage:e.slippage??null,takerFee:e.taker_fee??null}))}function d(){let e=l.db.select({total:(0,n.i6)`COALESCE(SUM(pnl), 0)`}).from(l.fK.trades).where((0,s.eq)(l.fK.trades.paper,!1)).get();return e?.total??0}function E(){let e=l.db.select({count:(0,n.i6)`COUNT(*)`}).from(l.fK.trades).where((0,s.eq)(l.fK.trades.paper,!1)).get();return e?.count??0}function u(){let e=l.db.select().from(l.fK.trades).orderBy(l.fK.trades.id).all(),t=0;return e.filter(e=>null!==e.pnl).map(e=>(t+=e.pnl??0,{timestamp:e.timestamp,pnl:e.pnl??0,cumulativePnl:t}))}function T(){let e=new Date().toISOString().slice(0,10),t=l.db.select({total:(0,n.i6)`COALESCE(SUM(pnl), 0)`}).from(l.fK.trades).where((0,n.i6)`timestamp >= ${e}`).get();return t?.total??0}function N(){let e=new Date().toISOString().slice(0,10),t=l.db.select({count:(0,n.i6)`COUNT(*)`}).from(l.fK.trades).where((0,n.i6)`pnl IS NOT NULL AND pnl < 0 AND timestamp >= ${e}`).get();return t?.count??0}function p(){let e=l.db.select({pnl:l.fK.trades.pnl}).from(l.fK.trades).where((0,n.i6)`pnl IS NOT NULL`).orderBy((0,i.C)(l.fK.trades.id)).limit(20).all(),t=0;for(let a of e)if((a.pnl??0)>0)t++;else break;return t}function m(e=30){let t=new Date(Date.now()-864e5*e).toISOString();return l.Bw.prepare(`
    SELECT asset,
           COUNT(*) as trades,
           SUM(CASE WHEN pnl > 0 THEN 1 ELSE 0 END) as wins,
           SUM(CASE WHEN pnl < 0 THEN 1 ELSE 0 END) as losses,
           COALESCE(SUM(pnl), 0) as pnl
    FROM trades
    WHERE pnl IS NOT NULL AND asset IS NOT NULL AND timestamp >= ?
    GROUP BY asset
  `).all(t).map(e=>({asset:e.asset,trades:e.trades,wins:e.wins,losses:e.losses,winRate:e.trades>0?e.wins/e.trades:0,pnl:e.pnl}))}function _(){return l.Bw.prepare(`
    SELECT sub_strategy,
           COUNT(*) as trades,
           SUM(CASE WHEN pnl > 0 THEN 1 ELSE 0 END) as wins,
           SUM(CASE WHEN pnl < 0 THEN 1 ELSE 0 END) as losses,
           COALESCE(SUM(pnl), 0) as pnl,
           COALESCE(AVG(pnl), 0) as avg_pnl
    FROM trades
    WHERE pnl IS NOT NULL AND sub_strategy IS NOT NULL
    GROUP BY sub_strategy
  `).all().map(e=>({strategy:e.sub_strategy,trades:e.trades,wins:e.wins,losses:e.losses,winRate:e.trades>0?e.wins/e.trades:0,pnl:e.pnl,avgPnl:e.avg_pnl}))}function c(e=30){let t=new Date(Date.now()-864e5*e).toISOString().slice(0,10);return l.Bw.prepare(`
    SELECT DATE(timestamp) as date,
           COALESCE(SUM(pnl), 0) as pnl,
           COUNT(*) as trades,
           SUM(CASE WHEN pnl > 0 THEN 1 ELSE 0 END) as wins,
           SUM(CASE WHEN pnl < 0 THEN 1 ELSE 0 END) as losses
    FROM trades
    WHERE pnl IS NOT NULL AND DATE(timestamp) >= ?
    GROUP BY DATE(timestamp)
    ORDER BY date
  `).all(t).map(e=>({date:e.date,pnl:e.pnl,trades:e.trades,wins:e.wins,losses:e.losses}))}function g(){return l.Bw.prepare(`
    SELECT CAST(strftime('%H', timestamp) AS INTEGER) as hour,
           COALESCE(SUM(pnl), 0) as pnl,
           COUNT(*) as trades
    FROM trades
    WHERE pnl IS NOT NULL
    GROUP BY hour
    ORDER BY hour
  `).all()}function f(){let e=l.db.select({avg:(0,n.i6)`COALESCE(AVG(slippage), 0)`}).from(l.fK.trades).where((0,n.i6)`slippage IS NOT NULL`).get();return e?.avg??0}function U(){let e=l.db.select().from(l.fK.settings).where((0,s.eq)(l.fK.settings.id,1)).get();if(!e)return{...o};let t=["BTC"];try{t=JSON.parse(e.enabledAssets||'["BTC"]')}catch{t=["BTC"]}let a=[{price:.48,allocation:.4},{price:.46,allocation:.35},{price:.44,allocation:.25}];try{a=JSON.parse(e.arbLadderLevels||"[]")}catch{}return{paperTrading:e.paperTrading,totalBankroll:e.totalBankroll,maxTotalExposure:e.maxTotalExposure,perWindowMax:e.perWindowMax,maxSimultaneousPositions:e.maxSimultaneousPositions,dailyLossLimit:e.dailyLossLimit,lossLimit:e.consecutiveLossLimit,enabledAssets:t,highConfEntryMin:e.highConfEntryMin,highConfEntryMax:e.highConfEntryMax,highConfTimeMin:e.highConfTimeMin,highConfTimeMax:e.highConfTimeMax,highConfEnabled:e.highConfEnabled,highConfBuyAmount:e.highConfBuyAmount,highConfBuyInterval:e.highConfBuyInterval,arbEnabled:e.arbitrageEnabled,arbMaxPerWindow:e.arbMaxPerWindow,arbBudgetUp:e.arbBudgetUp??null,arbBudgetDown:e.arbBudgetDown??null,arbLadderLevels:a,arbMaxCombinedCost:e.maxCombinedCost,arbCancelBeforeEnd:e.arbCancelBeforeEnd,arbMarket:e.arbMarket||"BTC",scalpEnabled:e.scalpEnabled??!0,scalpTradeSize:e.scalpTradeSize??12,scalpMaxPositions:e.scalpMaxPositions??2,scalpMinGap:e.scalpMinGap??75,scalpProfitTarget:e.scalpProfitTarget??.03,scalpEntryMin:e.scalpEntryMin??.15,scalpEntryMax:e.scalpEntryMax??.85,scalpCooldownWindows:e.scalpCooldownWindows??1,scalpExitWindow:e.scalpExitWindow??120}}function h(e){let t={};return void 0!==e.paperTrading&&(t.paperTrading=e.paperTrading),void 0!==e.totalBankroll&&(t.totalBankroll=e.totalBankroll),void 0!==e.maxTotalExposure&&(t.maxTotalExposure=e.maxTotalExposure),void 0!==e.perWindowMax&&(t.perWindowMax=e.perWindowMax),void 0!==e.maxSimultaneousPositions&&(t.maxSimultaneousPositions=e.maxSimultaneousPositions),void 0!==e.dailyLossLimit&&(t.dailyLossLimit=e.dailyLossLimit),void 0!==e.lossLimit&&(t.consecutiveLossLimit=e.lossLimit),void 0!==e.enabledAssets&&(t.enabledAssets=JSON.stringify(e.enabledAssets)),void 0!==e.highConfEntryMin&&(t.highConfEntryMin=e.highConfEntryMin),void 0!==e.highConfEntryMax&&(t.highConfEntryMax=e.highConfEntryMax),void 0!==e.highConfTimeMin&&(t.highConfTimeMin=e.highConfTimeMin),void 0!==e.highConfTimeMax&&(t.highConfTimeMax=e.highConfTimeMax),void 0!==e.highConfEnabled&&(t.highConfEnabled=e.highConfEnabled),void 0!==e.highConfBuyAmount&&(t.highConfBuyAmount=e.highConfBuyAmount),void 0!==e.highConfBuyInterval&&(t.highConfBuyInterval=e.highConfBuyInterval),void 0!==e.arbEnabled&&(t.arbitrageEnabled=e.arbEnabled),void 0!==e.arbMaxPerWindow&&(t.arbMaxPerWindow=e.arbMaxPerWindow),void 0!==e.arbBudgetUp&&(t.arbBudgetUp=e.arbBudgetUp),void 0!==e.arbBudgetDown&&(t.arbBudgetDown=e.arbBudgetDown),void 0!==e.arbLadderLevels&&(t.arbLadderLevels=JSON.stringify(e.arbLadderLevels)),void 0!==e.arbMaxCombinedCost&&(t.maxCombinedCost=e.arbMaxCombinedCost),void 0!==e.arbCancelBeforeEnd&&(t.arbCancelBeforeEnd=e.arbCancelBeforeEnd),void 0!==e.arbMarket&&(t.arbMarket=e.arbMarket),void 0!==e.scalpEnabled&&(t.scalpEnabled=e.scalpEnabled),void 0!==e.scalpTradeSize&&(t.scalpTradeSize=e.scalpTradeSize),void 0!==e.scalpMaxPositions&&(t.scalpMaxPositions=e.scalpMaxPositions),void 0!==e.scalpMinGap&&(t.scalpMinGap=e.scalpMinGap),void 0!==e.scalpProfitTarget&&(t.scalpProfitTarget=e.scalpProfitTarget),void 0!==e.scalpEntryMin&&(t.scalpEntryMin=e.scalpEntryMin),void 0!==e.scalpEntryMax&&(t.scalpEntryMax=e.scalpEntryMax),void 0!==e.scalpCooldownWindows&&(t.scalpCooldownWindows=e.scalpCooldownWindows),void 0!==e.scalpExitWindow&&(t.scalpExitWindow=e.scalpExitWindow),Object.keys(t).length>0&&l.db.update(l.fK.settings).set(t).where((0,s.eq)(l.fK.settings.id,1)).run(),U()}function A(e=6){let t=new Date(Date.now()-36e5*e).toISOString();return l.Bw.prepare(`SELECT DISTINCT condition_id, asset FROM trades
     WHERE paper = 0 AND action = 'buy' AND timestamp >= ?`).all(t).map(e=>({conditionId:e.condition_id,asset:e.asset||"BTC"}))}function b(){l.Bw.exec("DELETE FROM trades"),l.Bw.exec("DELETE FROM daily_stats"),l.Bw.exec("DELETE FROM market_performance")}}};