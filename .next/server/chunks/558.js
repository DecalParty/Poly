exports.id=558,exports.ids=[558],exports.modules={21150:()=>{},38054:(e,t,n)=>{"use strict";n.d(t,{db:()=>O,jO:()=>b,Bw:()=>R,fK:()=>a});var a={};n.r(a),n.d(a,{dailyStats:()=>N,marketPerformance:()=>m,settings:()=>T,trades:()=>d});var i=n(58757),s=n(92048),r=n(55315),l=n(87106),o=n(5795),L=n(53586),E=n(54341),u=n(20449);let d=(0,l.Px)("trades",{id:(0,o._L)("id").primaryKey({autoIncrement:!0}),timestamp:(0,L.fL)("timestamp").notNull(),conditionId:(0,L.fL)("condition_id").notNull(),slug:(0,L.fL)("slug").notNull(),side:(0,L.fL)("side",{enum:["yes","no"]}).notNull(),action:(0,L.fL)("action",{enum:["buy","sell","resolution"]}).notNull(),price:(0,E.kw)("price").notNull(),amount:(0,E.kw)("amount").notNull(),shares:(0,E.kw)("shares").notNull(),pnl:(0,E.kw)("pnl"),paper:(0,o._L)("paper",{mode:"boolean"}).notNull().default(!0),orderId:(0,L.fL)("order_id"),asset:(0,L.fL)("asset"),subStrategy:(0,L.fL)("sub_strategy"),binancePriceAtEntry:(0,E.kw)("binance_price_at_entry"),slippage:(0,E.kw)("slippage"),takerFee:(0,E.kw)("taker_fee")}),T=(0,l.Px)("settings",{id:(0,o._L)("id").primaryKey().default(1),buyAmount:(0,E.kw)("buy_amount").notNull().default(.1),buyIntervalSeconds:(0,o._L)("buy_interval_seconds").notNull().default(5),entryPriceMin:(0,E.kw)("entry_price_min").notNull().default(.9),entryPriceMax:(0,E.kw)("entry_price_max").notNull().default(.95),stopLossThreshold:(0,E.kw)("stop_loss_threshold").notNull().default(.5),maxMinutesRemaining:(0,o._L)("max_minutes_remaining").notNull().default(8),maxPositionSize:(0,E.kw)("max_position_size").notNull().default(5),paperTrading:(0,o._L)("paper_trading",{mode:"boolean"}).notNull().default(!0),totalBankroll:(0,E.kw)("total_bankroll").notNull().default(50),maxTotalExposure:(0,E.kw)("max_total_exposure").notNull().default(30),reserveAmount:(0,E.kw)("reserve_amount").notNull().default(20),perWindowMax:(0,E.kw)("per_window_max").notNull().default(8),maxSimultaneousPositions:(0,o._L)("max_simultaneous_positions").notNull().default(3),dailyLossLimit:(0,E.kw)("daily_loss_limit").notNull().default(10),consecutiveLossLimit:(0,o._L)("consecutive_loss_limit").notNull().default(5),enabledAssets:(0,L.fL)("enabled_assets").notNull().default('["BTC"]'),momentumMinPriceChange:(0,E.kw)("momentum_min_price_change").notNull().default(.001),momentumEntryMin:(0,E.kw)("momentum_entry_min").notNull().default(.6),momentumEntryMax:(0,E.kw)("momentum_entry_max").notNull().default(.93),momentumTimeMin:(0,o._L)("momentum_time_min").notNull().default(120),momentumTimeMax:(0,o._L)("momentum_time_max").notNull().default(480),momentumEnabled:(0,o._L)("momentum_enabled",{mode:"boolean"}).notNull().default(!0),highConfEntryMin:(0,E.kw)("high_conf_entry_min").notNull().default(.88),highConfEntryMax:(0,E.kw)("high_conf_entry_max").notNull().default(.96),highConfTimeMin:(0,o._L)("high_conf_time_min").notNull().default(60),highConfTimeMax:(0,o._L)("high_conf_time_max").notNull().default(480),highConfEnabled:(0,o._L)("high_conf_enabled",{mode:"boolean"}).notNull().default(!0),highConfBuyAmount:(0,E.kw)("high_conf_buy_amount").notNull().default(.1),highConfBuyInterval:(0,o._L)("high_conf_buy_interval").notNull().default(5),highConfStopLoss:(0,E.kw)("high_conf_stop_loss").notNull().default(.79),arbitrageEnabled:(0,o._L)("arbitrage_enabled",{mode:"boolean"}).notNull().default(!0),arbMaxPerWindow:(0,E.kw)("arb_max_per_window").notNull().default(10),arbBudgetUp:(0,E.kw)("arb_budget_up"),arbBudgetDown:(0,E.kw)("arb_budget_down"),arbLadderLevels:(0,L.fL)("arb_ladder_levels").notNull().default('[{"price":0.48,"allocation":0.40},{"price":0.46,"allocation":0.35},{"price":0.44,"allocation":0.25}]'),maxCombinedCost:(0,E.kw)("max_combined_cost").notNull().default(.97),arbCancelBeforeEnd:(0,o._L)("arb_cancel_before_end").notNull().default(120),arbMarket:(0,L.fL)("arb_market").notNull().default("BTC"),betAmount:(0,E.kw)("bet_amount").notNull().default(2)}),N=(0,l.Px)("daily_stats",{date:(0,L.fL)("date").primaryKey(),totalTrades:(0,o._L)("total_trades").notNull().default(0),wins:(0,o._L)("wins").notNull().default(0),losses:(0,o._L)("losses").notNull().default(0),pnl:(0,E.kw)("pnl").notNull().default(0),feesSpent:(0,E.kw)("fees_spent").notNull().default(0),arbitrageTrades:(0,o._L)("arbitrage_trades").notNull().default(0),momentumTrades:(0,o._L)("momentum_trades").notNull().default(0),highConfTrades:(0,o._L)("high_conf_trades").notNull().default(0),circuitBreakerTriggered:(0,o._L)("circuit_breaker_triggered").notNull().default(0)}),m=(0,l.Px)("market_performance",{asset:(0,L.fL)("asset").notNull(),date:(0,L.fL)("date").notNull(),trades:(0,o._L)("trades").notNull().default(0),wins:(0,o._L)("wins").notNull().default(0),losses:(0,o._L)("losses").notNull().default(0),pnl:(0,E.kw)("pnl").notNull().default(0)},e=>({pk:(0,u.CK)({columns:[e.asset,e.date]})})),_=(0,r.join)(process.cwd(),"data"),p=(0,r.join)(_,"trades.db");(0,s.existsSync)(_)||(0,s.mkdirSync)(_,{recursive:!0});let g=null;function f(){if(g)return g;throw Error("Database not initialized - call ensureDb() first")}function c(){let e=f().export();(0,s.writeFileSync)(p,Buffer.from(e))}class h{constructor(e){this.isRaw=!1,this.sql=e}raw(e=!0){return this.isRaw=e,this}bind(){return this}run(...e){let t=f(),n=1===e.length&&Array.isArray(e[0])?e[0]:e;return t.run(this.sql,n),c(),{changes:t.getRowsModified(),lastInsertRowid:0}}get(...e){let t=f(),n=1===e.length&&Array.isArray(e[0])?e[0]:e,a=t.prepare(this.sql);if(n.length>0&&a.bind(n),a.step()){if(this.isRaw){let e=a.get();return a.free(),e}let e=a.getColumnNames(),t=a.get(),n={};return e.forEach((e,a)=>n[e]=t[a]),a.free(),n}a.free()}all(...e){let t=f(),n=1===e.length&&Array.isArray(e[0])?e[0]:e,a=[],i=t.prepare(this.sql);for(n.length>0&&i.bind(n);i.step();)if(this.isRaw)a.push(i.get());else{let e=i.getColumnNames(),t=i.get(),n={};e.forEach((e,a)=>n[e]=t[a]),a.push(n)}return i.free(),a}}let U={prepare:e=>new h(e),exec(e){f().run(e),c()},pragma(e){},transaction:e=>()=>{f().run("BEGIN");try{let t=e();return f().run("COMMIT"),c(),t}catch(e){throw f().run("ROLLBACK"),e}}},A=null;function b(){return g?Promise.resolve():A||(A=(async()=>{let e=n(80470),t=await e();if((0,s.existsSync)(p)){let e=(0,s.readFileSync)(p);g=new t.Database(e)}else g=new t.Database;g.run(`
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
    `),g.run(`
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
    `),g.run(`
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
    `),g.run(`
      CREATE TABLE IF NOT EXISTS market_performance (
        asset TEXT NOT NULL,
        date TEXT NOT NULL,
        trades INTEGER NOT NULL DEFAULT 0,
        wins INTEGER NOT NULL DEFAULT 0,
        losses INTEGER NOT NULL DEFAULT 0,
        pnl REAL NOT NULL DEFAULT 0,
        PRIMARY KEY (asset, date)
      )
    `);let a=(e,t,n)=>{try{g.run(`ALTER TABLE ${e} ADD COLUMN ${t} ${n}`)}catch{}};a("trades","asset","TEXT"),a("trades","sub_strategy","TEXT"),a("trades","binance_price_at_entry","REAL"),a("trades","slippage","REAL"),a("trades","taker_fee","REAL"),a("settings","total_bankroll","REAL NOT NULL DEFAULT 50"),a("settings","max_total_exposure","REAL NOT NULL DEFAULT 30"),a("settings","reserve_amount","REAL NOT NULL DEFAULT 20"),a("settings","per_window_max","REAL NOT NULL DEFAULT 8"),a("settings","max_simultaneous_positions","INTEGER NOT NULL DEFAULT 3"),a("settings","daily_loss_limit","REAL NOT NULL DEFAULT 10"),a("settings","consecutive_loss_limit","INTEGER NOT NULL DEFAULT 5"),a("settings","enabled_assets","TEXT NOT NULL DEFAULT '[\"BTC\"]'"),a("settings","momentum_min_price_change","REAL NOT NULL DEFAULT 0.001"),a("settings","momentum_entry_min","REAL NOT NULL DEFAULT 0.60"),a("settings","momentum_entry_max","REAL NOT NULL DEFAULT 0.93"),a("settings","momentum_time_min","INTEGER NOT NULL DEFAULT 120"),a("settings","momentum_time_max","INTEGER NOT NULL DEFAULT 480"),a("settings","momentum_enabled","INTEGER NOT NULL DEFAULT 1"),a("settings","high_conf_entry_min","REAL NOT NULL DEFAULT 0.88"),a("settings","high_conf_entry_max","REAL NOT NULL DEFAULT 0.96"),a("settings","high_conf_time_min","INTEGER NOT NULL DEFAULT 60"),a("settings","high_conf_time_max","INTEGER NOT NULL DEFAULT 300"),a("settings","high_conf_enabled","INTEGER NOT NULL DEFAULT 1"),a("settings","high_conf_buy_amount","REAL NOT NULL DEFAULT 0.10"),a("settings","high_conf_buy_interval","INTEGER NOT NULL DEFAULT 5"),a("settings","high_conf_stop_loss","REAL NOT NULL DEFAULT 0.79"),a("settings","max_combined_cost","REAL NOT NULL DEFAULT 0.97"),a("settings","arbitrage_enabled","INTEGER NOT NULL DEFAULT 1"),a("settings","bet_amount","REAL NOT NULL DEFAULT 2.00"),a("settings","arb_max_per_window","REAL NOT NULL DEFAULT 10"),a("settings","arb_ladder_levels",'TEXT NOT NULL DEFAULT \'[{"price":0.48,"allocation":0.40},{"price":0.46,"allocation":0.35},{"price":0.44,"allocation":0.25}]\''),a("settings","arb_budget_up","REAL"),a("settings","arb_budget_down","REAL"),a("settings","arb_cancel_before_end","INTEGER NOT NULL DEFAULT 120"),a("settings","arb_market","TEXT NOT NULL DEFAULT 'BTC'"),g.run("INSERT OR IGNORE INTO settings (id) VALUES (1)"),c()})())}let O=(0,i.t)(U,{schema:a}),R=U},3412:(e,t,n)=>{"use strict";n.d(t,{UP:()=>c,vs:()=>m,NW:()=>E,Ql:()=>g,XJ:()=>f,sS:()=>_,xc:()=>p,Jl:()=>d,lv:()=>L,Gw:()=>h,uF:()=>N,_l:()=>T,yW:()=>u,Ei:()=>o,sE:()=>A,VP:()=>U});var a=n(31626),i=n(81445),s=n(57745),r=n(38054);let l={paperTrading:!0,totalBankroll:50,maxTotalExposure:30,perWindowMax:8,maxSimultaneousPositions:3,dailyLossLimit:10,lossLimit:5,enabledAssets:["BTC"],highConfEntryMin:.9,highConfEntryMax:.95,highConfTimeMin:30,highConfTimeMax:480,highConfEnabled:!0,highConfBuyAmount:.1,highConfBuyInterval:5,arbEnabled:!0,arbMaxPerWindow:10,arbBudgetUp:null,arbBudgetDown:null,arbLadderLevels:[{price:.48,allocation:.4},{price:.46,allocation:.35},{price:.44,allocation:.25}],arbMaxCombinedCost:.97,arbCancelBeforeEnd:120,arbMarket:"BTC"};function o(e){var t;return{id:(t=r.db.insert(r.fK.trades).values({timestamp:e.timestamp,conditionId:e.conditionId,slug:e.slug,side:e.side,action:e.action,price:e.price,amount:e.amount,shares:e.shares,pnl:e.pnl,paper:e.paper,orderId:e.orderId,asset:e.asset,subStrategy:e.subStrategy,binancePriceAtEntry:e.binancePriceAtEntry,slippage:e.slippage,takerFee:e.takerFee}).returning().get()).id,timestamp:t.timestamp,conditionId:t.conditionId,slug:t.slug,side:t.side,action:t.action,price:t.price,amount:t.amount,shares:t.shares,pnl:t.pnl,paper:t.paper,orderId:t.orderId,asset:t.asset||null,subStrategy:t.subStrategy||null,binancePriceAtEntry:t.binancePriceAtEntry??null,slippage:t.slippage??null,takerFee:t.takerFee??null}}function L(e=50,t){let n="SELECT * FROM trades",a=[],i=[];return t?.asset&&(a.push("asset = ?"),i.push(t.asset)),t?.strategy&&(a.push("sub_strategy = ?"),i.push(t.strategy)),t?.from&&(a.push("timestamp >= ?"),i.push(t.from)),t?.to&&(a.push("timestamp <= ?"),i.push(t.to)),a.length>0&&(n+=" WHERE "+a.join(" AND ")),n+=" ORDER BY id DESC LIMIT ?",i.push(e),r.Bw.prepare(n).all(...i).map(e=>({id:e.id,timestamp:e.timestamp,conditionId:e.condition_id,slug:e.slug,side:e.side,action:e.action,price:e.price,amount:e.amount,shares:e.shares,pnl:e.pnl,paper:!!e.paper,orderId:e.order_id,asset:e.asset,subStrategy:e.sub_strategy,binancePriceAtEntry:e.binance_price_at_entry??null,slippage:e.slippage??null,takerFee:e.taker_fee??null}))}function E(){let e=r.db.select({total:(0,a.i6)`COALESCE(SUM(pnl), 0)`}).from(r.fK.trades).get();return e?.total??0}function u(){let e=r.db.select({count:(0,a.i6)`COUNT(*)`}).from(r.fK.trades).get();return e?.count??0}function d(){let e=r.db.select().from(r.fK.trades).orderBy(r.fK.trades.id).all(),t=0;return e.filter(e=>null!==e.pnl).map(e=>(t+=e.pnl??0,{timestamp:e.timestamp,pnl:e.pnl??0,cumulativePnl:t}))}function T(){let e=new Date().toISOString().slice(0,10),t=r.db.select({total:(0,a.i6)`COALESCE(SUM(pnl), 0)`}).from(r.fK.trades).where((0,a.i6)`timestamp >= ${e}`).get();return t?.total??0}function N(){let e=new Date().toISOString().slice(0,10),t=r.db.select({count:(0,a.i6)`COUNT(*)`}).from(r.fK.trades).where((0,a.i6)`pnl IS NOT NULL AND pnl < 0 AND timestamp >= ${e}`).get();return t?.count??0}function m(){let e=r.db.select({pnl:r.fK.trades.pnl}).from(r.fK.trades).where((0,a.i6)`pnl IS NOT NULL`).orderBy((0,i.C)(r.fK.trades.id)).limit(20).all(),t=0;for(let n of e)if((n.pnl??0)>0)t++;else break;return t}function _(e=30){let t=new Date(Date.now()-864e5*e).toISOString();return r.Bw.prepare(`
    SELECT asset,
           COUNT(*) as trades,
           SUM(CASE WHEN pnl > 0 THEN 1 ELSE 0 END) as wins,
           SUM(CASE WHEN pnl < 0 THEN 1 ELSE 0 END) as losses,
           COALESCE(SUM(pnl), 0) as pnl
    FROM trades
    WHERE pnl IS NOT NULL AND asset IS NOT NULL AND timestamp >= ?
    GROUP BY asset
  `).all(t).map(e=>({asset:e.asset,trades:e.trades,wins:e.wins,losses:e.losses,winRate:e.trades>0?e.wins/e.trades:0,pnl:e.pnl}))}function p(){return r.Bw.prepare(`
    SELECT sub_strategy,
           COUNT(*) as trades,
           SUM(CASE WHEN pnl > 0 THEN 1 ELSE 0 END) as wins,
           SUM(CASE WHEN pnl < 0 THEN 1 ELSE 0 END) as losses,
           COALESCE(SUM(pnl), 0) as pnl,
           COALESCE(AVG(pnl), 0) as avg_pnl
    FROM trades
    WHERE pnl IS NOT NULL AND sub_strategy IS NOT NULL
    GROUP BY sub_strategy
  `).all().map(e=>({strategy:e.sub_strategy,trades:e.trades,wins:e.wins,losses:e.losses,winRate:e.trades>0?e.wins/e.trades:0,pnl:e.pnl,avgPnl:e.avg_pnl}))}function g(e=30){let t=new Date(Date.now()-864e5*e).toISOString().slice(0,10);return r.Bw.prepare(`
    SELECT DATE(timestamp) as date,
           COALESCE(SUM(pnl), 0) as pnl,
           COUNT(*) as trades,
           SUM(CASE WHEN pnl > 0 THEN 1 ELSE 0 END) as wins,
           SUM(CASE WHEN pnl < 0 THEN 1 ELSE 0 END) as losses
    FROM trades
    WHERE pnl IS NOT NULL AND DATE(timestamp) >= ?
    GROUP BY DATE(timestamp)
    ORDER BY date
  `).all(t).map(e=>({date:e.date,pnl:e.pnl,trades:e.trades,wins:e.wins,losses:e.losses}))}function f(){return r.Bw.prepare(`
    SELECT CAST(strftime('%H', timestamp) AS INTEGER) as hour,
           COALESCE(SUM(pnl), 0) as pnl,
           COUNT(*) as trades
    FROM trades
    WHERE pnl IS NOT NULL
    GROUP BY hour
    ORDER BY hour
  `).all()}function c(){let e=r.db.select({avg:(0,a.i6)`COALESCE(AVG(slippage), 0)`}).from(r.fK.trades).where((0,a.i6)`slippage IS NOT NULL`).get();return e?.avg??0}function h(){let e=r.db.select().from(r.fK.settings).where((0,s.eq)(r.fK.settings.id,1)).get();if(!e)return{...l};let t=["BTC"];try{t=JSON.parse(e.enabledAssets||'["BTC"]')}catch{t=["BTC"]}let n=[{price:.48,allocation:.4},{price:.46,allocation:.35},{price:.44,allocation:.25}];try{n=JSON.parse(e.arbLadderLevels||"[]")}catch{}return{paperTrading:e.paperTrading,totalBankroll:e.totalBankroll,maxTotalExposure:e.maxTotalExposure,perWindowMax:e.perWindowMax,maxSimultaneousPositions:e.maxSimultaneousPositions,dailyLossLimit:e.dailyLossLimit,lossLimit:e.consecutiveLossLimit,enabledAssets:t,highConfEntryMin:e.highConfEntryMin,highConfEntryMax:e.highConfEntryMax,highConfTimeMin:e.highConfTimeMin,highConfTimeMax:e.highConfTimeMax,highConfEnabled:e.highConfEnabled,highConfBuyAmount:e.highConfBuyAmount,highConfBuyInterval:e.highConfBuyInterval,arbEnabled:e.arbitrageEnabled,arbMaxPerWindow:e.arbMaxPerWindow,arbBudgetUp:e.arbBudgetUp??null,arbBudgetDown:e.arbBudgetDown??null,arbLadderLevels:n,arbMaxCombinedCost:e.maxCombinedCost,arbCancelBeforeEnd:e.arbCancelBeforeEnd,arbMarket:e.arbMarket||"BTC"}}function U(e){let t={};return void 0!==e.paperTrading&&(t.paperTrading=e.paperTrading),void 0!==e.totalBankroll&&(t.totalBankroll=e.totalBankroll),void 0!==e.maxTotalExposure&&(t.maxTotalExposure=e.maxTotalExposure),void 0!==e.perWindowMax&&(t.perWindowMax=e.perWindowMax),void 0!==e.maxSimultaneousPositions&&(t.maxSimultaneousPositions=e.maxSimultaneousPositions),void 0!==e.dailyLossLimit&&(t.dailyLossLimit=e.dailyLossLimit),void 0!==e.lossLimit&&(t.consecutiveLossLimit=e.lossLimit),void 0!==e.enabledAssets&&(t.enabledAssets=JSON.stringify(e.enabledAssets)),void 0!==e.highConfEntryMin&&(t.highConfEntryMin=e.highConfEntryMin),void 0!==e.highConfEntryMax&&(t.highConfEntryMax=e.highConfEntryMax),void 0!==e.highConfTimeMin&&(t.highConfTimeMin=e.highConfTimeMin),void 0!==e.highConfTimeMax&&(t.highConfTimeMax=e.highConfTimeMax),void 0!==e.highConfEnabled&&(t.highConfEnabled=e.highConfEnabled),void 0!==e.highConfBuyAmount&&(t.highConfBuyAmount=e.highConfBuyAmount),void 0!==e.highConfBuyInterval&&(t.highConfBuyInterval=e.highConfBuyInterval),void 0!==e.arbEnabled&&(t.arbitrageEnabled=e.arbEnabled),void 0!==e.arbMaxPerWindow&&(t.arbMaxPerWindow=e.arbMaxPerWindow),void 0!==e.arbBudgetUp&&(t.arbBudgetUp=e.arbBudgetUp),void 0!==e.arbBudgetDown&&(t.arbBudgetDown=e.arbBudgetDown),void 0!==e.arbLadderLevels&&(t.arbLadderLevels=JSON.stringify(e.arbLadderLevels)),void 0!==e.arbMaxCombinedCost&&(t.maxCombinedCost=e.arbMaxCombinedCost),void 0!==e.arbCancelBeforeEnd&&(t.arbCancelBeforeEnd=e.arbCancelBeforeEnd),void 0!==e.arbMarket&&(t.arbMarket=e.arbMarket),Object.keys(t).length>0&&r.db.update(r.fK.settings).set(t).where((0,s.eq)(r.fK.settings.id,1)).run(),h()}function A(){r.Bw.exec("DELETE FROM trades"),r.Bw.exec("DELETE FROM daily_stats"),r.Bw.exec("DELETE FROM market_performance")}}};