exports.id=558,exports.ids=[558],exports.modules={21150:()=>{},38054:(e,t,a)=>{"use strict";a.d(t,{db:()=>y,jO:()=>b,Bw:()=>O,fK:()=>n});var n={};a.r(n),a.d(n,{dailyStats:()=>N,marketPerformance:()=>p,settings:()=>T,trades:()=>u});var i=a(58757),s=a(92048),l=a(55315),r=a(87106),o=a(5795),E=a(53586),L=a(54341),d=a(20449);let u=(0,r.Px)("trades",{id:(0,o._L)("id").primaryKey({autoIncrement:!0}),timestamp:(0,E.fL)("timestamp").notNull(),conditionId:(0,E.fL)("condition_id").notNull(),slug:(0,E.fL)("slug").notNull(),side:(0,E.fL)("side",{enum:["yes","no"]}).notNull(),action:(0,E.fL)("action",{enum:["buy","sell","resolution"]}).notNull(),price:(0,L.kw)("price").notNull(),amount:(0,L.kw)("amount").notNull(),shares:(0,L.kw)("shares").notNull(),pnl:(0,L.kw)("pnl"),paper:(0,o._L)("paper",{mode:"boolean"}).notNull().default(!0),orderId:(0,E.fL)("order_id"),asset:(0,E.fL)("asset"),subStrategy:(0,E.fL)("sub_strategy"),binancePriceAtEntry:(0,L.kw)("binance_price_at_entry"),slippage:(0,L.kw)("slippage"),takerFee:(0,L.kw)("taker_fee")}),T=(0,r.Px)("settings",{id:(0,o._L)("id").primaryKey().default(1),buyAmount:(0,L.kw)("buy_amount").notNull().default(.1),buyIntervalSeconds:(0,o._L)("buy_interval_seconds").notNull().default(5),entryPriceMin:(0,L.kw)("entry_price_min").notNull().default(.9),entryPriceMax:(0,L.kw)("entry_price_max").notNull().default(.95),stopLossThreshold:(0,L.kw)("stop_loss_threshold").notNull().default(.5),maxMinutesRemaining:(0,o._L)("max_minutes_remaining").notNull().default(8),maxPositionSize:(0,L.kw)("max_position_size").notNull().default(5),paperTrading:(0,o._L)("paper_trading",{mode:"boolean"}).notNull().default(!0),totalBankroll:(0,L.kw)("total_bankroll").notNull().default(50),maxTotalExposure:(0,L.kw)("max_total_exposure").notNull().default(30),reserveAmount:(0,L.kw)("reserve_amount").notNull().default(20),perWindowMax:(0,L.kw)("per_window_max").notNull().default(8),maxSimultaneousPositions:(0,o._L)("max_simultaneous_positions").notNull().default(3),dailyLossLimit:(0,L.kw)("daily_loss_limit").notNull().default(10),consecutiveLossLimit:(0,o._L)("consecutive_loss_limit").notNull().default(5),enabledAssets:(0,E.fL)("enabled_assets").notNull().default('["BTC"]'),momentumMinPriceChange:(0,L.kw)("momentum_min_price_change").notNull().default(.001),momentumEntryMin:(0,L.kw)("momentum_entry_min").notNull().default(.6),momentumEntryMax:(0,L.kw)("momentum_entry_max").notNull().default(.93),momentumTimeMin:(0,o._L)("momentum_time_min").notNull().default(120),momentumTimeMax:(0,o._L)("momentum_time_max").notNull().default(480),momentumEnabled:(0,o._L)("momentum_enabled",{mode:"boolean"}).notNull().default(!0),highConfEntryMin:(0,L.kw)("high_conf_entry_min").notNull().default(.88),highConfEntryMax:(0,L.kw)("high_conf_entry_max").notNull().default(.96),highConfTimeMin:(0,o._L)("high_conf_time_min").notNull().default(60),highConfTimeMax:(0,o._L)("high_conf_time_max").notNull().default(480),highConfEnabled:(0,o._L)("high_conf_enabled",{mode:"boolean"}).notNull().default(!0),highConfBuyAmount:(0,L.kw)("high_conf_buy_amount").notNull().default(.1),highConfBuyInterval:(0,o._L)("high_conf_buy_interval").notNull().default(5),highConfStopLoss:(0,L.kw)("high_conf_stop_loss").notNull().default(.79),arbitrageEnabled:(0,o._L)("arbitrage_enabled",{mode:"boolean"}).notNull().default(!0),arbMaxPerWindow:(0,L.kw)("arb_max_per_window").notNull().default(10),arbBudgetUp:(0,L.kw)("arb_budget_up"),arbBudgetDown:(0,L.kw)("arb_budget_down"),arbLadderLevels:(0,E.fL)("arb_ladder_levels").notNull().default('[{"price":0.48,"allocation":0.40},{"price":0.46,"allocation":0.35},{"price":0.44,"allocation":0.25}]'),maxCombinedCost:(0,L.kw)("max_combined_cost").notNull().default(.97),arbCancelBeforeEnd:(0,o._L)("arb_cancel_before_end").notNull().default(120),arbMarket:(0,E.fL)("arb_market").notNull().default("BTC"),scalpEnabled:(0,o._L)("scalp_enabled",{mode:"boolean"}).notNull().default(!0),scalpTradeSize:(0,L.kw)("scalp_trade_size").notNull().default(12),scalpMaxPositions:(0,o._L)("scalp_max_positions").notNull().default(2),scalpMinGap:(0,L.kw)("scalp_min_gap").notNull().default(.02),scalpProfitTarget:(0,L.kw)("scalp_profit_target").notNull().default(.03),scalpEntryMin:(0,L.kw)("scalp_entry_min").notNull().default(.15),scalpEntryMax:(0,L.kw)("scalp_entry_max").notNull().default(.85),scalpCooldownWindows:(0,o._L)("scalp_cooldown_windows").notNull().default(1),scalpExitWindow:(0,o._L)("scalp_exit_window").notNull().default(120),scalpHalfSizeAfter:(0,o._L)("scalp_half_size_after").notNull().default(420),betAmount:(0,L.kw)("bet_amount").notNull().default(2)}),N=(0,r.Px)("daily_stats",{date:(0,E.fL)("date").primaryKey(),totalTrades:(0,o._L)("total_trades").notNull().default(0),wins:(0,o._L)("wins").notNull().default(0),losses:(0,o._L)("losses").notNull().default(0),pnl:(0,L.kw)("pnl").notNull().default(0),feesSpent:(0,L.kw)("fees_spent").notNull().default(0),arbitrageTrades:(0,o._L)("arbitrage_trades").notNull().default(0),momentumTrades:(0,o._L)("momentum_trades").notNull().default(0),highConfTrades:(0,o._L)("high_conf_trades").notNull().default(0),circuitBreakerTriggered:(0,o._L)("circuit_breaker_triggered").notNull().default(0)}),p=(0,r.Px)("market_performance",{asset:(0,E.fL)("asset").notNull(),date:(0,E.fL)("date").notNull(),trades:(0,o._L)("trades").notNull().default(0),wins:(0,o._L)("wins").notNull().default(0),losses:(0,o._L)("losses").notNull().default(0),pnl:(0,L.kw)("pnl").notNull().default(0)},e=>({pk:(0,d.CK)({columns:[e.asset,e.date]})})),_=(0,l.join)(process.cwd(),"data"),m=(0,l.join)(_,"trades.db");(0,s.existsSync)(_)||(0,s.mkdirSync)(_,{recursive:!0});let c=null;function f(){if(c)return c;throw Error("Database not initialized - call ensureDb() first")}function g(){let e=f().export();(0,s.writeFileSync)(m,Buffer.from(e))}class U{constructor(e){this.isRaw=!1,this.sql=e}raw(e=!0){return this.isRaw=e,this}bind(){return this}run(...e){let t=f(),a=1===e.length&&Array.isArray(e[0])?e[0]:e;return t.run(this.sql,a),g(),{changes:t.getRowsModified(),lastInsertRowid:0}}get(...e){let t=f(),a=1===e.length&&Array.isArray(e[0])?e[0]:e,n=t.prepare(this.sql);if(a.length>0&&n.bind(a),n.step()){if(this.isRaw){let e=n.get();return n.free(),e}let e=n.getColumnNames(),t=n.get(),a={};return e.forEach((e,n)=>a[e]=t[n]),n.free(),a}n.free()}all(...e){let t=f(),a=1===e.length&&Array.isArray(e[0])?e[0]:e,n=[],i=t.prepare(this.sql);for(a.length>0&&i.bind(a);i.step();)if(this.isRaw)n.push(i.get());else{let e=i.getColumnNames(),t=i.get(),a={};e.forEach((e,n)=>a[e]=t[n]),n.push(a)}return i.free(),n}}let A={prepare:e=>new U(e),exec(e){f().run(e),g()},pragma(e){},transaction:e=>()=>{f().run("BEGIN");try{let t=e();return f().run("COMMIT"),g(),t}catch(e){throw f().run("ROLLBACK"),e}}},h=null;function b(){return c?Promise.resolve():h||(h=(async()=>{let e=a(80470),t=await e();if((0,s.existsSync)(m)){let e=(0,s.readFileSync)(m);c=new t.Database(e)}else c=new t.Database;c.run(`
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
    `);let n=(e,t,a)=>{try{c.run(`ALTER TABLE ${e} ADD COLUMN ${t} ${a}`)}catch{}};n("trades","asset","TEXT"),n("trades","sub_strategy","TEXT"),n("trades","binance_price_at_entry","REAL"),n("trades","slippage","REAL"),n("trades","taker_fee","REAL"),n("settings","total_bankroll","REAL NOT NULL DEFAULT 50"),n("settings","max_total_exposure","REAL NOT NULL DEFAULT 30"),n("settings","reserve_amount","REAL NOT NULL DEFAULT 20"),n("settings","per_window_max","REAL NOT NULL DEFAULT 8"),n("settings","max_simultaneous_positions","INTEGER NOT NULL DEFAULT 3"),n("settings","daily_loss_limit","REAL NOT NULL DEFAULT 10"),n("settings","consecutive_loss_limit","INTEGER NOT NULL DEFAULT 5"),n("settings","enabled_assets","TEXT NOT NULL DEFAULT '[\"BTC\"]'"),n("settings","momentum_min_price_change","REAL NOT NULL DEFAULT 0.001"),n("settings","momentum_entry_min","REAL NOT NULL DEFAULT 0.60"),n("settings","momentum_entry_max","REAL NOT NULL DEFAULT 0.93"),n("settings","momentum_time_min","INTEGER NOT NULL DEFAULT 120"),n("settings","momentum_time_max","INTEGER NOT NULL DEFAULT 480"),n("settings","momentum_enabled","INTEGER NOT NULL DEFAULT 1"),n("settings","high_conf_entry_min","REAL NOT NULL DEFAULT 0.88"),n("settings","high_conf_entry_max","REAL NOT NULL DEFAULT 0.96"),n("settings","high_conf_time_min","INTEGER NOT NULL DEFAULT 60"),n("settings","high_conf_time_max","INTEGER NOT NULL DEFAULT 300"),n("settings","high_conf_enabled","INTEGER NOT NULL DEFAULT 1"),n("settings","high_conf_buy_amount","REAL NOT NULL DEFAULT 0.10"),n("settings","high_conf_buy_interval","INTEGER NOT NULL DEFAULT 5"),n("settings","high_conf_stop_loss","REAL NOT NULL DEFAULT 0.79"),n("settings","max_combined_cost","REAL NOT NULL DEFAULT 0.97"),n("settings","arbitrage_enabled","INTEGER NOT NULL DEFAULT 1"),n("settings","bet_amount","REAL NOT NULL DEFAULT 2.00"),n("settings","arb_max_per_window","REAL NOT NULL DEFAULT 10"),n("settings","arb_ladder_levels",'TEXT NOT NULL DEFAULT \'[{"price":0.48,"allocation":0.40},{"price":0.46,"allocation":0.35},{"price":0.44,"allocation":0.25}]\''),n("settings","arb_budget_up","REAL"),n("settings","arb_budget_down","REAL"),n("settings","arb_cancel_before_end","INTEGER NOT NULL DEFAULT 120"),n("settings","arb_market","TEXT NOT NULL DEFAULT 'BTC'"),n("settings","scalp_enabled","INTEGER NOT NULL DEFAULT 1"),n("settings","scalp_trade_size","REAL NOT NULL DEFAULT 12"),n("settings","scalp_max_positions","INTEGER NOT NULL DEFAULT 2"),n("settings","scalp_min_gap","REAL NOT NULL DEFAULT 0.03"),n("settings","scalp_profit_target","REAL NOT NULL DEFAULT 0.03"),n("settings","scalp_entry_min","REAL NOT NULL DEFAULT 0.15"),n("settings","scalp_entry_max","REAL NOT NULL DEFAULT 0.85"),n("settings","scalp_cooldown_windows","INTEGER NOT NULL DEFAULT 1"),n("settings","scalp_exit_window","INTEGER NOT NULL DEFAULT 120"),n("settings","scalp_half_size_after","INTEGER NOT NULL DEFAULT 420"),c.run(`UPDATE settings SET
      scalp_min_gap = 0.02,
      scalp_profit_target = 0.03,
      scalp_entry_min = 0.15,
      scalp_entry_max = 0.85,
      scalp_exit_window = 120
      WHERE ROUND(scalp_min_gap, 2) NOT IN (0.01, 0.02)
         OR ROUND(scalp_entry_min, 2) != 0.15
         OR ROUND(scalp_entry_max, 2) != 0.85`),c.run("INSERT OR IGNORE INTO settings (id) VALUES (1)"),g()})())}let y=(0,i.t)(A,{schema:n}),O=A},3412:(e,t,a)=>{"use strict";a.d(t,{UP:()=>g,vs:()=>p,NW:()=>L,Ql:()=>c,XJ:()=>f,sS:()=>_,xc:()=>m,Jl:()=>u,JU:()=>h,lv:()=>E,Gw:()=>U,uF:()=>N,_l:()=>T,yW:()=>d,Ei:()=>o,sE:()=>b,VP:()=>A});var n=a(31626),i=a(57745),s=a(81445),l=a(38054);let r={paperTrading:!0,maxTotalExposure:30,dailyLossLimit:10,lossLimit:5,enabledAssets:["BTC"],highConfEntryMin:.9,highConfEntryMax:.95,highConfTimeMin:30,highConfTimeMax:480,highConfEnabled:!1,highConfBuyAmount:.1,highConfBuyInterval:5,arbEnabled:!1,arbMaxPerWindow:10,arbBudgetUp:null,arbBudgetDown:null,arbLadderLevels:[{price:.48,allocation:.4},{price:.46,allocation:.35},{price:.44,allocation:.25}],arbMaxCombinedCost:.97,arbCancelBeforeEnd:120,arbMarket:"BTC",scalpEnabled:!0,scalpTradeSize:12,scalpMaxPositions:2,scalpMinGap:.02,scalpProfitTarget:.02,scalpEntryMin:.15,scalpEntryMax:.85,scalpExitWindow:120,scalpHalfSizeAfter:420,valueEnabled:!0,valueTradeSize:15,valueMaxPositions:1,valueMinGap:.03,valueProfitTarget:.03,valueEntryMin:.2,valueEntryMax:.8,valueExitWindow:60,valueMaxSecondsRemaining:480};function o(e){var t;return{id:(t=l.db.insert(l.fK.trades).values({timestamp:e.timestamp,conditionId:e.conditionId,slug:e.slug,side:e.side,action:e.action,price:e.price,amount:e.amount,shares:e.shares,pnl:e.pnl,paper:e.paper,orderId:e.orderId,asset:e.asset,subStrategy:e.subStrategy,binancePriceAtEntry:e.binancePriceAtEntry,slippage:e.slippage,takerFee:e.takerFee}).returning().get()).id,timestamp:t.timestamp,conditionId:t.conditionId,slug:t.slug,side:t.side,action:t.action,price:t.price,amount:t.amount,shares:t.shares,pnl:t.pnl,paper:t.paper,orderId:t.orderId,asset:t.asset||null,subStrategy:t.subStrategy||null,binancePriceAtEntry:t.binancePriceAtEntry??null,slippage:t.slippage??null,takerFee:t.takerFee??null}}function E(e=50,t){let a="SELECT * FROM trades",n=[],i=[];return t?.asset&&(n.push("asset = ?"),i.push(t.asset)),t?.strategy&&(n.push("sub_strategy = ?"),i.push(t.strategy)),t?.from&&(n.push("timestamp >= ?"),i.push(t.from)),t?.to&&(n.push("timestamp <= ?"),i.push(t.to)),n.length>0&&(a+=" WHERE "+n.join(" AND ")),a+=" ORDER BY id DESC LIMIT ?",i.push(e),l.Bw.prepare(a).all(...i).map(e=>({id:e.id,timestamp:e.timestamp,conditionId:e.condition_id,slug:e.slug,side:e.side,action:e.action,price:e.price,amount:e.amount,shares:e.shares,pnl:e.pnl,paper:!!e.paper,orderId:e.order_id,asset:e.asset,subStrategy:e.sub_strategy,binancePriceAtEntry:e.binance_price_at_entry??null,slippage:e.slippage??null,takerFee:e.taker_fee??null}))}function L(){let e=l.db.select({total:(0,n.i6)`COALESCE(SUM(pnl), 0)`}).from(l.fK.trades).where((0,i.eq)(l.fK.trades.paper,!1)).get();return e?.total??0}function d(){let e=l.db.select({count:(0,n.i6)`COUNT(*)`}).from(l.fK.trades).where((0,i.eq)(l.fK.trades.paper,!1)).get();return e?.count??0}function u(){let e=l.db.select().from(l.fK.trades).orderBy(l.fK.trades.id).all(),t=0;return e.filter(e=>null!==e.pnl).map(e=>(t+=e.pnl??0,{timestamp:e.timestamp,pnl:e.pnl??0,cumulativePnl:t}))}function T(){let e=new Date().toISOString().slice(0,10),t=l.db.select({total:(0,n.i6)`COALESCE(SUM(pnl), 0)`}).from(l.fK.trades).where((0,n.i6)`timestamp >= ${e}`).get();return t?.total??0}function N(){let e=new Date().toISOString().slice(0,10),t=l.db.select({count:(0,n.i6)`COUNT(*)`}).from(l.fK.trades).where((0,n.i6)`pnl IS NOT NULL AND pnl < 0 AND timestamp >= ${e}`).get();return t?.count??0}function p(){let e=l.db.select({pnl:l.fK.trades.pnl}).from(l.fK.trades).where((0,n.i6)`pnl IS NOT NULL`).orderBy((0,s.C)(l.fK.trades.id)).limit(20).all(),t=0;for(let a of e)if((a.pnl??0)>0)t++;else break;return t}function _(e=30){let t=new Date(Date.now()-864e5*e).toISOString();return l.Bw.prepare(`
    SELECT asset,
           COUNT(*) as trades,
           SUM(CASE WHEN pnl > 0 THEN 1 ELSE 0 END) as wins,
           SUM(CASE WHEN pnl < 0 THEN 1 ELSE 0 END) as losses,
           COALESCE(SUM(pnl), 0) as pnl
    FROM trades
    WHERE pnl IS NOT NULL AND asset IS NOT NULL AND timestamp >= ?
    GROUP BY asset
  `).all(t).map(e=>({asset:e.asset,trades:e.trades,wins:e.wins,losses:e.losses,winRate:e.trades>0?e.wins/e.trades:0,pnl:e.pnl}))}function m(){return l.Bw.prepare(`
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
  `).all(t).map(e=>({date:e.date,pnl:e.pnl,trades:e.trades,wins:e.wins,losses:e.losses}))}function f(){return l.Bw.prepare(`
    SELECT CAST(strftime('%H', timestamp) AS INTEGER) as hour,
           COALESCE(SUM(pnl), 0) as pnl,
           COUNT(*) as trades
    FROM trades
    WHERE pnl IS NOT NULL
    GROUP BY hour
    ORDER BY hour
  `).all()}function g(){let e=l.db.select({avg:(0,n.i6)`COALESCE(AVG(slippage), 0)`}).from(l.fK.trades).where((0,n.i6)`slippage IS NOT NULL`).get();return e?.avg??0}function U(){let e=l.db.select().from(l.fK.settings).where((0,i.eq)(l.fK.settings.id,1)).get();if(!e)return{...r};let t=["BTC"];try{t=JSON.parse(e.enabledAssets||'["BTC"]')}catch{t=["BTC"]}let a=[{price:.48,allocation:.4},{price:.46,allocation:.35},{price:.44,allocation:.25}];try{a=JSON.parse(e.arbLadderLevels||"[]")}catch{}return{paperTrading:e.paperTrading,maxTotalExposure:e.maxTotalExposure,dailyLossLimit:e.dailyLossLimit,lossLimit:e.consecutiveLossLimit,enabledAssets:t,highConfEntryMin:e.highConfEntryMin,highConfEntryMax:e.highConfEntryMax,highConfTimeMin:e.highConfTimeMin,highConfTimeMax:e.highConfTimeMax,highConfEnabled:e.highConfEnabled,highConfBuyAmount:e.highConfBuyAmount,highConfBuyInterval:e.highConfBuyInterval,arbEnabled:e.arbitrageEnabled,arbMaxPerWindow:e.arbMaxPerWindow,arbBudgetUp:e.arbBudgetUp??null,arbBudgetDown:e.arbBudgetDown??null,arbLadderLevels:a,arbMaxCombinedCost:e.maxCombinedCost,arbCancelBeforeEnd:e.arbCancelBeforeEnd,arbMarket:e.arbMarket||"BTC",scalpEnabled:e.scalpEnabled??!0,scalpTradeSize:e.scalpTradeSize??12,scalpMaxPositions:e.scalpMaxPositions??2,scalpMinGap:e.scalpMinGap??.02,scalpProfitTarget:e.scalpProfitTarget??.02,scalpEntryMin:e.scalpEntryMin??.15,scalpEntryMax:e.scalpEntryMax??.85,scalpExitWindow:e.scalpExitWindow??120,scalpHalfSizeAfter:e.scalpHalfSizeAfter??420,valueEnabled:e.valueEnabled??!0,valueTradeSize:e.valueTradeSize??15,valueMaxPositions:e.valueMaxPositions??1,valueMinGap:e.valueMinGap??.03,valueProfitTarget:e.valueProfitTarget??.03,valueEntryMin:e.valueEntryMin??.2,valueEntryMax:e.valueEntryMax??.8,valueExitWindow:e.valueExitWindow??60,valueMaxSecondsRemaining:e.valueMaxSecondsRemaining??480}}function A(e){let t={};return void 0!==e.paperTrading&&(t.paperTrading=e.paperTrading),void 0!==e.maxTotalExposure&&(t.maxTotalExposure=e.maxTotalExposure),void 0!==e.dailyLossLimit&&(t.dailyLossLimit=e.dailyLossLimit),void 0!==e.lossLimit&&(t.consecutiveLossLimit=e.lossLimit),void 0!==e.enabledAssets&&(t.enabledAssets=JSON.stringify(e.enabledAssets)),void 0!==e.highConfEntryMin&&(t.highConfEntryMin=e.highConfEntryMin),void 0!==e.highConfEntryMax&&(t.highConfEntryMax=e.highConfEntryMax),void 0!==e.highConfTimeMin&&(t.highConfTimeMin=e.highConfTimeMin),void 0!==e.highConfTimeMax&&(t.highConfTimeMax=e.highConfTimeMax),void 0!==e.highConfEnabled&&(t.highConfEnabled=e.highConfEnabled),void 0!==e.highConfBuyAmount&&(t.highConfBuyAmount=e.highConfBuyAmount),void 0!==e.highConfBuyInterval&&(t.highConfBuyInterval=e.highConfBuyInterval),void 0!==e.arbEnabled&&(t.arbitrageEnabled=e.arbEnabled),void 0!==e.arbMaxPerWindow&&(t.arbMaxPerWindow=e.arbMaxPerWindow),void 0!==e.arbBudgetUp&&(t.arbBudgetUp=e.arbBudgetUp),void 0!==e.arbBudgetDown&&(t.arbBudgetDown=e.arbBudgetDown),void 0!==e.arbLadderLevels&&(t.arbLadderLevels=JSON.stringify(e.arbLadderLevels)),void 0!==e.arbMaxCombinedCost&&(t.maxCombinedCost=e.arbMaxCombinedCost),void 0!==e.arbCancelBeforeEnd&&(t.arbCancelBeforeEnd=e.arbCancelBeforeEnd),void 0!==e.arbMarket&&(t.arbMarket=e.arbMarket),void 0!==e.scalpEnabled&&(t.scalpEnabled=e.scalpEnabled),void 0!==e.scalpTradeSize&&(t.scalpTradeSize=e.scalpTradeSize),void 0!==e.scalpMaxPositions&&(t.scalpMaxPositions=e.scalpMaxPositions),void 0!==e.scalpMinGap&&(t.scalpMinGap=e.scalpMinGap),void 0!==e.scalpProfitTarget&&(t.scalpProfitTarget=e.scalpProfitTarget),void 0!==e.scalpEntryMin&&(t.scalpEntryMin=e.scalpEntryMin),void 0!==e.scalpEntryMax&&(t.scalpEntryMax=e.scalpEntryMax),void 0!==e.scalpExitWindow&&(t.scalpExitWindow=e.scalpExitWindow),void 0!==e.scalpHalfSizeAfter&&(t.scalpHalfSizeAfter=e.scalpHalfSizeAfter),void 0!==e.valueEnabled&&(t.valueEnabled=e.valueEnabled),void 0!==e.valueTradeSize&&(t.valueTradeSize=e.valueTradeSize),void 0!==e.valueMaxPositions&&(t.valueMaxPositions=e.valueMaxPositions),void 0!==e.valueMinGap&&(t.valueMinGap=e.valueMinGap),void 0!==e.valueProfitTarget&&(t.valueProfitTarget=e.valueProfitTarget),void 0!==e.valueEntryMin&&(t.valueEntryMin=e.valueEntryMin),void 0!==e.valueEntryMax&&(t.valueEntryMax=e.valueEntryMax),void 0!==e.valueExitWindow&&(t.valueExitWindow=e.valueExitWindow),void 0!==e.valueMaxSecondsRemaining&&(t.valueMaxSecondsRemaining=e.valueMaxSecondsRemaining),Object.keys(t).length>0&&l.db.update(l.fK.settings).set(t).where((0,i.eq)(l.fK.settings.id,1)).run(),U()}function h(e=6){let t=new Date(Date.now()-36e5*e).toISOString();return l.Bw.prepare(`SELECT DISTINCT condition_id, asset FROM trades
     WHERE paper = 0 AND action = 'buy' AND timestamp >= ?`).all(t).map(e=>({conditionId:e.condition_id,asset:e.asset||"BTC"}))}function b(){l.Bw.exec("DELETE FROM trades"),l.Bw.exec("DELETE FROM daily_stats"),l.Bw.exec("DELETE FROM market_performance")}}};