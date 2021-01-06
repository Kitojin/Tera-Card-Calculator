//TODO: This used to be a bad cmd tool, rewrite to make it work with github pages

const charStats = {
		power: 511,
		pamp: 1489,
		mamp: 127433,
		mana: 8306,
		cp: 3.42,
		pcp: 2,
		mcp: 2.23,
		damageFromCrits: 0.95,
		skillPmod: 0.5,
		skillMmod: 1.35,
		piercing: 0,
		ignore: 656,
		partyShred: 17600,
	},
	target = {
		baseRes: 80000,
		targetType: 'Azart',
	},
	MAX_POINTS = 15,
	MAX_CARDS_PER_CATEGORY = 1,
	MAX_AMOUNT_CARDS = 4,
	CONSIDER_CRIT_CARDS = true;

const powerset = new Set();

target.finalRes = Math.max(
	(target.baseRes - charStats.partyShred - charStats.ignore) *
		(1 -
			calcPiercePercent(
				charStats.piercing,
				target.baseRes - charStats.partyShred - charStats.ignore,
			)),
	-33333,
);

//STEP 1, generate power set of ALL card combinations
//TODO: find a way to not do this and only get combinations we're actually interested in right away?
for (let subset of generateSubsets(cards)) {
	powerset.add(subset);
}

//STEP 2, iterate over powerset and sort out invalid entries (point/category limit)
for (let subset of powerset) {
	if (subset.length > MAX_AMOUNT_CARDS || subset.length == 0) {
		powerset.delete(subset);
		continue;
	}
	subset.totalBonusPamp = 0;
	subset.totalBonusMamp = 0;
	subset.totalBonusCf = 0;
	subset.totalBonusMcp = 0;
	subset.totalBonusPcp = 0;
	let pointcost = 0,
		categoryCount = {
			npc: 0,
			monster: 0,
			fish: 0,
			location: 0,
			mount: 0,
		};

	for (let card of subset) {
		subset.totalBonusPamp += card.targetType
			? card.targetType == target.targetType
				? card.pamp || 0
				: 0
			: card.pamp || 0;
		subset.totalBonusMamp += card.targetType
			? card.targetType == target.targetType
				? card.mamp || 0
				: 0
			: card.mamp || 0;
		subset.totalBonusMcp += card.targetType
			? card.targetType == target.targetType
				? card.mcp || 0
				: 0
			: card.mcp || 0;
		subset.totalBonusPcp += card.targetType
			? card.targetType == target.targetType
				? card.pcp || 0
				: 0
			: card.pcp || 0;
		subset.totalBonusCf += card.crit || 0;
		pointcost += card.cost;
		categoryCount[card.category]++;
	}
	if (pointcost > MAX_POINTS) {
		powerset.delete(subset);
		continue;
	}
	for (const [category, amount] of Object.entries(categoryCount)) {
		if (amount > MAX_CARDS_PER_CATEGORY) {
			powerset.delete(subset);
			break;
		}
	}
}

//STEP 3, calculate dps gain for all valid sets
let currentBestSubset = undefined;
for (let subset of powerset) {
	subset.totalDpsGain =
		(1 +
			calcDpsGainAmp(
				subset.totalBonusPamp,
				subset.totalBonusMamp,
				subset.totalBonusPcp,
				subset.totalBonusMcp,
			)) *
			(1 +
				(CONSIDER_CRIT_CARDS ? 1 : 0) * calcDpsGainCrit(subset.totalBonusCf)) -
		1;
	if (!currentBestSubset) currentBestSubset = subset;
	if (currentBestSubset.totalDpsGain < subset.totalDpsGain)
		currentBestSubset = subset;
}
//do second run after best subset has been found to check for alternative subsets of equal value (idk if really needed)
// for (let subset of powerset) {
// 	if (subset.totalDpsGain == currentBestSubset.totalDpsGain)
// 		console.log(
// 			`equally valid subsets found!\nSubset 1:\n${JSON.stringify(
// 				currentBestSubset,
// 				null,
// 				1
// 			)}\nsubset 2\n${JSON.stringify(subset, null, 1)}`
// 		);
// }

console.log(
	`\n==================\nbest subset for given parameters (${
		currentBestSubset.totalDpsGain * 100
	} %DPS gain):\n${JSON.stringify(
		currentBestSubset,
		null,
		2,
	)}\n==================`,
);

// ======================= HELPER THINGIES =========================
function calcPiercePercent(pierce, specialDef) {
	//Pierce does not affect damage if base - shred - ignore <= 0
	return specialDef > 0 ? Math.min(pierce / (pierce + 10000), 0.8) : 0;
}

function* generateSubsets(array, offset = 0) {
	while (offset < array.length) {
		let first = array[offset++];
		for (let subset of generateSubsets(array, offset)) {
			subset.push(first);
			yield subset;
		}
	}
	yield [];
}

function calcDpsGainAmp(
	bonusPamp = 0,
	bonusMamp = 0,
	bonusPcp = 0,
	bonusMcp = 0,
) {
	return (
		((1 +
			((charStats.pamp + bonusPamp) * charStats.skillPmod) /
				(100000 + target.finalRes) +
			((charStats.mamp + bonusMamp) * charStats.skillMmod) /
				(100000 + target.finalRes)) *
			(1 - charStats.damageFromCrits) +
			(1 * charStats.cp * 0.9 +
				((charStats.pamp + bonusPamp) *
					charStats.skillPmod *
					(charStats.pcp + bonusPcp)) /
					(100000 + target.finalRes) +
				((charStats.mamp + bonusMamp) *
					charStats.skillMmod *
					(charStats.mcp + bonusMcp)) /
					(100000 + target.finalRes)) *
				charStats.damageFromCrits) /
			((1 +
				(charStats.pamp * charStats.skillPmod) / (100000 + target.finalRes) +
				(charStats.mamp * charStats.skillMmod) / (100000 + target.finalRes)) *
				(1 - charStats.damageFromCrits) +
				(1 * charStats.cp * 0.9 +
					(charStats.pamp * charStats.skillPmod * charStats.pcp) /
						(100000 + target.finalRes) +
					(charStats.mamp * charStats.skillMmod * charStats.mcp) /
						(100000 + target.finalRes)) *
					charStats.damageFromCrits) -
		1
	);
}

function calcDpsGainCrit(bonusCrit = 0) {
	return (100 + charStats.power + bonusCrit / 2) / (100 + charStats.power) - 1;
}
