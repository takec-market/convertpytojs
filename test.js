const initial_supply = 1000000000; // 初期発行量 (GLS)
const initial_token_price = 0.03; // 初期価格（USD）
const final_token_price = 0.05;   // 終端価格（USD）
const price_pattern = "random";  // 'linear', 'u', 'inverse_u', 'random'
const annual_inflation_rate = 0.05;
const staking_participation_rate = 0.6;
const user_stake = 1000000;
const compound_staking = true;

const distribution_ratios = {
  "バリデータ報酬": 0.25,
  "インフラ協力・帯域負担": 0.20,
  "ガス代スポンサー補填": 0.15,
  "エコシステム整備基金": 0.30,
  "管理・予備費": 0.10
};

const tx_per_month = 20000000;
const avg_gls_per_tx = 0.021;
const gls_to_validator_ratio = 1;

function linspace(start, end, num) {
  const arr = [];
  if (num === 1) return [start];
  const step = (end - start) / (num - 1);
  for (let i = 0; i < num; i++) {
    arr.push(start + step * i);
  }
  return arr;
}

const months = Array.from({length:12}, (_, i) => `${i+1}月`);
let price_curve;
if (price_pattern === "linear") {
  price_curve = linspace(initial_token_price, final_token_price, 12);
} else if (price_pattern === "u") {
  const x = linspace(0, 1, 12);
  price_curve = x.map(v => initial_token_price + (final_token_price - initial_token_price) * (1 - Math.cos(Math.PI * v)) / 2);
} else if (price_pattern === "inverse_u") {
  const x = linspace(0, 1, 12);
  price_curve = x.map(v => initial_token_price + (final_token_price - initial_token_price) * (Math.cos(Math.PI * v)) / 2);
} else if (price_pattern === "random") {
  let steps = Array.from({length:12}, () => Math.random());
  for (let i = 1; i < steps.length; i++) steps[i] += steps[i-1];
  const min = Math.min(...steps);
  const max = Math.max(...steps);
  steps = steps.map(s => (s - min) / (max - min));
  price_curve = steps.map(s => initial_token_price + s * (final_token_price - initial_token_price));
} else {
  price_curve = Array(12).fill(initial_token_price);
}

const monthly_inflation = Math.pow(1 + annual_inflation_rate, 1/12) - 1;
const total_annual_inflation = initial_supply * annual_inflation_rate;
const monthly_inflation_pool = total_annual_inflation / 12;
const total_staked = initial_supply * staking_participation_rate;

const monthly_role_rewards = {};
for (const [role, ratio] of Object.entries(distribution_ratios)) {
  monthly_role_rewards[role] = Array(12).fill(monthly_inflation_pool * ratio);
}
const monthly_rewards_validator_total = monthly_role_rewards["バリデータ報酬"];

let user_stake_tracker = user_stake;
const monthly_rewards_inflation = [];
const monthly_rewards_tx = [];
for (let i = 0; i < 12; i++) {
  const share = user_stake_tracker / total_staked;
  const infl = share * monthly_rewards_validator_total[i];
  const tx = share * tx_per_month * avg_gls_per_tx * gls_to_validator_ratio;
  const tx_usd = tx * price_curve[i];
  const tx_gls_equiv = tx_usd / price_curve[i];

  monthly_rewards_inflation.push(infl);
  monthly_rewards_tx.push(tx_gls_equiv);

  if (compound_staking) {
    user_stake_tracker += infl + tx_gls_equiv;
  }
}

function sum(arr) { return arr.reduce((a,b) => a+b, 0); }
function round(val, digits) {
  const factor = Math.pow(10, digits);
  return Math.round(val * factor) / factor;
}

const monthly_arp_inflation = monthly_rewards_inflation.map(r => (r / user_stake) * 12 * 100);
const monthly_arp_tx = monthly_rewards_tx.map(r => (r / user_stake) * 12 * 100);
const total_monthly_rewards = monthly_rewards_inflation.map((r,i) => r + monthly_rewards_tx[i]);
const total_monthly_arp = total_monthly_rewards.map(r => (r / user_stake) * 12 * 100);

const sum_rewards_inflation = round(sum(monthly_rewards_inflation), 2);
const sum_rewards_tx = round(sum(monthly_rewards_tx), 2);
const sum_total_rewards = round(sum(total_monthly_rewards), 2);
const sum_arp_inflation = round(sum(monthly_arp_inflation) / 12, 2);
const sum_arp_tx = round(sum(monthly_arp_tx) / 12, 2);
const sum_total_arp = round(sum(total_monthly_arp) / 12, 2);

const role_totals_gls = {};
for (const [role, vals] of Object.entries(monthly_role_rewards)) {
  role_totals_gls[role] = round(sum(vals), 2);
}
const role_totals_usd = {};
for (const role of Object.keys(role_totals_gls)) {
  role_totals_usd[role] = round(role_totals_gls[role] * price_curve[price_curve.length - 1], 2);
}

const monthly_sum_gls = [];
for (let i = 0; i < 12; i++) {
  let total = 0;
  for (const vals of Object.values(monthly_role_rewards)) {
    total += vals[i];
  }
  monthly_sum_gls.push(round(total, 2));
}
const monthly_sum_usd = monthly_sum_gls.map((g,i) => round(g * price_curve[i], 2));

const header = ["項目", ...months, "年間合計"];
const rows = [
  ["個人インフレ報酬 (GLS)", ...monthly_rewards_inflation.map(r => round(r,2)), sum_rewards_inflation],
  ["個人tx手数料報酬 (GLS)", ...monthly_rewards_tx.map(r => round(r,2)), sum_rewards_tx],
  ["個人合計報酬 (GLS)", ...total_monthly_rewards.map(r => round(r,2)), sum_total_rewards],
  ["個人ARP (インフレ%)", ...monthly_arp_inflation.map(r => round(r,2)), sum_arp_inflation],
  ["個人ARP (tx手数料%)", ...monthly_arp_tx.map(r => round(r,2)), sum_arp_tx],
  ["個人ARP (合計%)", ...total_monthly_arp.map(r => round(r,2)), sum_total_arp],
  ["月次価格 (USD)", ...price_curve.map(p => round(p,4)), "-"],
  Array(months.length + 2).fill("")
];
rows.push(["バリデータ全体報酬 (GLS)", ...monthly_rewards_validator_total.map(v => round(v,2)), role_totals_gls["バリデータ報酬"]]);
for (const [role, vals] of Object.entries(monthly_role_rewards)) {
  if (role === "バリデータ報酬") continue;
  rows.push([`${role} (GLS)`, ...vals.map(v => round(v,2)), role_totals_gls[role]]);
}
rows.push(["分配合計 (GLS)", ...monthly_sum_gls, round(sum(Object.values(role_totals_gls)), 2)]);
rows.push(["分配合計 (USD)", ...monthly_sum_usd, round(sum(Object.values(role_totals_usd)), 2)]);

const params = [
  ["=== 入力パラメータ ==="],
  ["初期発行量 (GLS):", initial_supply],
  ["初期価格 (USD):", initial_token_price],
  ["終端価格 (USD):", final_token_price],
  ["価格変化パターン:", price_pattern],
  ["年間インフレ率:", annual_inflation_rate],
  ["ステーキング参加率:", staking_participation_rate],
  ["初期ステーキング量:", user_stake],
  ["複利ステーキング:", compound_staking],
  ["tx数/月:", tx_per_month],
  ["平均GLS/tx:", avg_gls_per_tx],
  ["tx手数料バリデータ分配率:", gls_to_validator_ratio],
  [""],
  ["分配設計"],
];
for (const [role, pct] of Object.entries(distribution_ratios)) {
  params.push([`${role} (%):`, `${round(pct*100,2)}%`]);
}
params.push([""]);

for (const row of params) {
  console.log(row.join("\t"));
}
for (const row of [header, ...rows]) {
  console.log(row.join("\t"));
}
