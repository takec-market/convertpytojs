# === 入力項目 ===
initial_supply = 1_000_000_000  # 初期発行量 (GLS)
initial_token_price = 0.03      # 初期価格（USD）
final_token_price = 0.05        # 終端価格（USD）
price_pattern = "random"        # 価格変化パターン: 'linear', 'u', 'inverse_u', 'random'
annual_inflation_rate = 0.05
staking_participation_rate = 0.6
user_stake = 1_000_000
compound_staking = True

# 分配設計
distribution_ratios = {
    "バリデータ報酬": 0.25,
    "インフラ協力・帯域負担": 0.20,
    "ガス代スポンサー補填": 0.15,
    "エコシステム整備基金": 0.30,
    "管理・予備費": 0.10
}

# tx手数料関連
tx_per_month = 20_000_000
avg_gls_per_tx = 0.021
gls_to_validator_ratio = 1

# 月初ごとの価格を生成（12ヶ月）
import numpy as np
np.random.seed(42)
months = [f"{i+1}月" for i in range(12)]

if price_pattern == "linear":
    price_curve = np.linspace(initial_token_price, final_token_price, 12)
elif price_pattern == "u":
    x = np.linspace(0, 1, 12)
    price_curve = initial_token_price + (final_token_price - initial_token_price) * (1 - np.cos(np.pi * x)) / 2
elif price_pattern == "inverse_u":
    x = np.linspace(0, 1, 12)
    price_curve = initial_token_price + (final_token_price - initial_token_price) * (np.cos(np.pi * x)) / 2
elif price_pattern == "random":
    steps = np.random.rand(12)
    steps = np.cumsum(steps)
    steps = (steps - steps.min()) / (steps.max() - steps.min())
    price_curve = initial_token_price + steps * (final_token_price - initial_token_price)
else:
    price_curve = [initial_token_price] * 12

monthly_inflation = (1 + annual_inflation_rate) ** (1 / 12) - 1
total_annual_inflation = initial_supply * annual_inflation_rate
monthly_inflation_pool = total_annual_inflation / 12
total_staked = initial_supply * staking_participation_rate

monthly_role_rewards = {
    role: [monthly_inflation_pool * ratio for _ in range(12)]
    for role, ratio in distribution_ratios.items()
}
monthly_rewards_validator_total = monthly_role_rewards["バリデータ報酬"]

user_stake_tracker = user_stake
monthly_rewards_inflation = []
monthly_rewards_tx = []

for i in range(12):
    share = user_stake_tracker / total_staked
    infl = share * monthly_rewards_validator_total[i]
    tx = share * tx_per_month * avg_gls_per_tx * gls_to_validator_ratio
    tx_usd = tx * price_curve[i]
    tx_gls_equiv = tx_usd / price_curve[i]

    monthly_rewards_inflation.append(infl)
    monthly_rewards_tx.append(tx_gls_equiv)

    if compound_staking:
        user_stake_tracker += infl + tx_gls_equiv

monthly_arp_inflation = [(r / user_stake) * 12 * 100 for r in monthly_rewards_inflation]
monthly_arp_tx = [(r / user_stake) * 12 * 100 for r in monthly_rewards_tx]
total_monthly_rewards = [a + b for a, b in zip(monthly_rewards_inflation, monthly_rewards_tx)]
total_monthly_arp = [(r / user_stake) * 12 * 100 for r in total_monthly_rewards]

# 合計
sum_rewards_inflation = round(sum(monthly_rewards_inflation), 2)
sum_rewards_tx = round(sum(monthly_rewards_tx), 2)
sum_total_rewards = round(sum(total_monthly_rewards), 2)
sum_arp_inflation = round(sum(monthly_arp_inflation)/12, 2)
sum_arp_tx = round(sum(monthly_arp_tx)/12, 2)
sum_total_arp = round(sum(total_monthly_arp)/12, 2)

role_totals_gls = {role: round(sum(vals), 2) for role, vals in monthly_role_rewards.items()}
role_totals_usd = {role: round(role_totals_gls[role] * price_curve[-1], 2) for role in role_totals_gls}
monthly_sum_gls = [round(sum(m), 2) for m in zip(*monthly_role_rewards.values())]
monthly_sum_usd = [round(g * p, 2) for g, p in zip(monthly_sum_gls, price_curve)]

# 出力
header = ["項目"] + months + ["年間合計"]
rows = [
    ["個人インフレ報酬 (GLS)"] + [round(r, 2) for r in monthly_rewards_inflation] + [sum_rewards_inflation],
    ["個人tx手数料報酬 (GLS)"] + [round(r, 2) for r in monthly_rewards_tx] + [sum_rewards_tx],
    ["個人合計報酬 (GLS)"] + [round(r, 2) for r in total_monthly_rewards] + [sum_total_rewards],
    ["個人ARP (インフレ%)"] + [round(r, 2) for r in monthly_arp_inflation] + [sum_arp_inflation],
    ["個人ARP (tx手数料%)"] + [round(r, 2) for r in monthly_arp_tx] + [sum_arp_tx],
    ["個人ARP (合計%)"] + [round(r, 2) for r in total_monthly_arp] + [sum_total_arp],
    ["月次価格 (USD)"] + [round(p, 4) for p in price_curve] + ["-"],
    [""] * (len(months) + 2),
    ["バリデータ全体報酬 (GLS)"] + [round(v, 2) for v in monthly_rewards_validator_total] + [role_totals_gls["バリデータ報酬"]]
]

for role, vals in monthly_role_rewards.items():
    if role == "バリデータ報酬": continue
    rows.append([f"{role} (GLS)"] + [round(v, 2) for v in vals] + [role_totals_gls[role]])

rows.append(["分配合計 (GLS)"] + monthly_sum_gls + [round(sum(role_totals_gls.values()), 2)])
rows.append(["分配合計 (USD)"] + monthly_sum_usd + [round(sum(role_totals_usd.values()), 2)])

params = [
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
    [""]
]
params.append(["分配設計"])
for role, pct in distribution_ratios.items():
    params.append([role + " (%):", f"{round(pct*100,2)}%"])
params.append([""])

for row in params:
    print("\t".join(map(str, row)))
for row in [header] + rows:
    print("\t".join(map(str, row)))