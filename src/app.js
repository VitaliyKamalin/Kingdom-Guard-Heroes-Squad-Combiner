const { createApp } = Vue;

const app = createApp({
	data() {
		return {
			heroes: [],
			collapsedGroups: {
				Archer: true,
				Ice: true,
				Fire: true,
				Goblin: true
			},
			elementNames: {
				Archer: 'Лучница',
				Fire: 'Огненный маг',
				Ice: 'Ледяная колдунья',
				Goblin: 'Гоблин',
			},
			perkNames: {
				march_speed_percent: 'Скорость войск',
				carry_weight_percent: 'Грузоподъемность',
				power_percent: 'Мощь всех войск',
				recovery_percent: 'Восстановленных бойцов',
				collect_gold_percent: 'Скорость сбора золота',
				offline_gold_percent: 'Добыча золота оффлайн',
				heal_speed_percent: 'Скорость восстановления',
				TD_power_percent: '(TD) Мощь всех войск',
				TD_archer_power_percent: '(TD) Мощь лучниц',
				TD_archer_speed_percent: '(TD) Скорость лучниц',
				power_archer_percent: 'Мощь всех лучниц',
				cost_energy_percent: 'Сокращение трат ОД',
			},
			perkUsedColumns: [
				'power_percent',
				'march_speed_percent',
				'recovery_percent',
				'heal_speed_percent',
			],
			perkAllColumns: [
				'carry_weight_percent',
				'cost_energy_percent',
				'collect_gold_percent',
				'offline_gold_percent',
				'TD_power_percent',
				'TD_archer_power_percent',
				'TD_archer_speed_percent',
				'power_archer_percent'
			],
			squadSize: 3, // размер отряда (2 или 3)
			squadCombosCollapsed: {}, // { [element]: true/false }
			squadCombosShownCount: {}, // { [element]: number }
			maxSquadsToShow: 15,
		};
	},
	async mounted() {
		this.loadState();
		try {
			const response = await fetch('data/heroes.json');
			const data = await response.json();
			
			if (!this.heroes || !this.heroes.length) {
				this.heroes = data.heroes;
			}
			
			for (const element of Object.keys(this.elementNames)) {
				if (!(element in this.squadCombosCollapsed)) {
					this.squadCombosCollapsed[element] = true;
				}
				if (!(element in this.squadCombosShownCount)) {
					this.squadCombosShownCount[element] = 3;
				}
			}
		} catch (error) {
			console.error('Error fetching heroes:', error);
		}
	},
	computed: {
		groupedHeroes() {
			const groups = {};
			this.sortedHeroes.forEach(hero => {
				if (!groups[hero.element]) groups[hero.element] = [];
				groups[hero.element].push(hero);
			});
			return groups;
		},
		sortedHeroes() {
			const order = [...this.perkUsedColumns];
			return this.heroes.slice().sort((a, b) => {
				for (const perk of order) {
					const aPerkValue = a.perks.filter(p => p.key === perk).reduce((sum, p) => sum + (p.value || 0), 0);
					const bPerkValue = b.perks.filter(p => p.key === perk).reduce((sum, p) => sum + (p.value || 0), 0);
					if (aPerkValue !== bPerkValue) {
						return bPerkValue - aPerkValue;
					}
				}
				return 0;
			});
		},
		squadCombosByElement() {
			const squadSize = Number(this.squadSize);
			
			function getCombinations(arr, k) {
				const res = [];
				function helper(start, combo) {
					if (combo.length === k) {
						res.push(combo.slice());
						return;
					}
					for (let i = start; i < arr.length; i++) {
						combo.push(arr[i]);
						helper(i + 1, combo);
						combo.pop();
					}
				}
				helper(0, []);
				return res;
			}

			if (!this.heroes || this.heroes.length < this.squadSize) return {};
			const combosByElement = {};


			for (const element in this.groupedHeroes) {
				const heroes = this.groupedHeroes[element].filter(hero => hero.hasHero !== false);
				if (heroes.length < squadSize) continue;
				const combos = [];
				const heroCombos = getCombinations(heroes, squadSize);
				for (const combo of heroCombos) {
					for (let i = 0; i < combo.length; i++) {
						const leader = combo[i];
						const members = combo.filter((_, idx) => idx !== i);
						
						const perkMap = {};
						
						for (const perk of leader.perks) {
							perkMap[perk.key] = (perkMap[perk.key] || 0) + (perk.value || 0);
						}
						
						for (const m of members) {
							for (const perk of m.perks) {
								if (!perk.leaderOnly) {
									perkMap[perk.key] = (perkMap[perk.key] || 0) + (perk.value || 0);
								}
							}
						}
						
						const perksArr = Object.keys(perkMap).map(key => ({
							key,
							name: this.perkNames[key] || key,
							value: perkMap[key]
						})).sort((a, b) => {
							const usedColumns = [...this.perkUsedColumns, ...this.perkAllColumns];
							const aIndex = usedColumns.indexOf(a.key);
							const bIndex = usedColumns.indexOf(b.key);
							// if (a.value !== b.value) return b.value - a.value; // по убыванию значения
							return aIndex - bIndex;
						});
						
						function getHeroStars(hero, usedPerkKeys, isLeader) {
							let maxLvl = 0;
							for (const perk of hero.perks) {
								if (
									usedPerkKeys.includes(perk.key) &&
									(isLeader || !perk.leaderOnly)
								) {
									if (perk.lvl && perk.lvl > maxLvl) maxLvl = perk.lvl;
								}
							}
							return maxLvl;
						}
						const usedPerkKeys = perksArr.map(p => p.key);

						const leaderWithStars = {
							...leader,
							stars: getHeroStars(leader, usedPerkKeys, true)
						};
						const membersWithStars = members.map(m => ({
							...m,
							stars: getHeroStars(m, usedPerkKeys, false)
						}));
						
						let sortKey = 0;
						for (const perk of this.perkUsedColumns.length ? this.perkUsedColumns : [...this.perkUsedColumns, ...this.perkAllColumns]) {
							const val = perkMap[perk] || 0;
							sortKey = sortKey * 10000 + val;
						}
						combos.push({
							leader: leaderWithStars,
							members: membersWithStars,
							perks: perksArr,
							perksCount: perksArr.length,
							perksSum: perksArr.reduce((sum, p) => sum + (p.value || 0), 0),
							starsCount: leaderWithStars.stars + membersWithStars.reduce((sum, m) => sum + m.stars, 0),
							sortKey,
							element
						});
					}
				}
				
				combos.sort((a, b) => {
					if (b.sortKey !== a.sortKey) {
						return b.sortKey - a.sortKey; // по убыванию эффективности
					}
					
					if (b.perksCount !== a.perksCount) {
						return b.perksCount - a.perksCount;
					}
					return a.starsCount - b.starsCount; // при равенстве — по увеличению количества звёзд
				});

				combosByElement[element] = combos; //.slice(0, 15);
			}
			return combosByElement;
		}
	},
	watch: {
		heroes: {
			handler() { this.saveState(); },
			deep: true
		},
		perkUsedColumns: {
			handler() { this.saveState(); },
			deep: true
		},
		perkAllColumns: {
			handler() { this.saveState(); },
			deep: true
		},
		collapsedGroups: {
			handler() { this.saveState(); },
			deep: true
		},
		squadSize(val) { this.saveState(); },
		squadCombosCollapsed: {
			handler() { this.saveState(); },
			deep: true
		},
		squadCombosShownCount: {
			handler() { this.saveState(); },
			deep: true
		},
		maxSquadsToShow(val) { this.saveState(); },
	},
	methods: {
		saveState() {
			const state = {
				heroes: this.heroes,
				perkUsedColumns: this.perkUsedColumns,
				perkAllColumns: this.perkAllColumns,
				collapsedGroups: this.collapsedGroups,
				squadSize: this.squadSize,
				squadCombosCollapsed: this.squadCombosCollapsed,
				squadCombosShownCount: this.squadCombosShownCount,
				maxSquadsToShow: this.maxSquadsToShow
			};
			localStorage.setItem('kg_app_state', JSON.stringify(state));
		},
		loadState() {
			const state = localStorage.getItem('kg_app_state');
			if (state) {
				try {
					const parsed = JSON.parse(state);
					if (parsed.heroes) this.heroes = parsed.heroes;
					if (parsed.perkUsedColumns) this.perkUsedColumns = parsed.perkUsedColumns;
					if (parsed.perkAllColumns) this.perkAllColumns = parsed.perkAllColumns;
					if (parsed.collapsedGroups) this.collapsedGroups = parsed.collapsedGroups;
					if (parsed.squadSize) this.squadSize = parsed.squadSize;
					if (parsed.squadCombosCollapsed) this.squadCombosCollapsed = parsed.squadCombosCollapsed;
					if (parsed.squadCombosShownCount) this.squadCombosShownCount = parsed.squadCombosShownCount;
					if (parsed.maxSquadsToShow) this.maxSquadsToShow = parsed.maxSquadsToShow;
				} catch (e) {
					console.warn('Ошибка загрузки состояния:', e);
				}
			}
		},
		resetState() {
			localStorage.removeItem('kg_app_state');
			location.reload();
		},
		getPerkName(perk) {
			if (!perk || !perk.key) return '— нет информации';
			const name = this.perkNames[perk.key] || perk.key;
			let value = perk.value ? `: ${perk.value}%` : '';
			let leader = perk.leaderOnly ? ' (лидер)' : '';
			return `${name}${value}${leader}`;
		},
		getElementName(element) {
			return this.elementNames[element] || element;
		},
		toggleGroup(element) {
			this.collapsedGroups = {
				...this.collapsedGroups,
				[element]: !this.collapsedGroups[element]
			};
		},
		isCollapsed(element) {
			return !!this.collapsedGroups[element];
		},
		getHeroCardClass(hero) {
			if (hero.hasHero === false) return 'hero-card-grey';
			if (hero.from_awards_hall) return 'hero-card-blue';
			if (hero.from_self_selection) return 'hero-card-yellow';
			if (hero.from_tavern_common || hero.from_tavern_advanced || hero.from_tavern_professional) return 'hero-card-green';
			if (hero.from_event) return 'hero-card-red';
			return '';
		},
		toggleHasHero(hero) {
			this.heroes[hero.id].hasHero = !this.heroes[hero.id].hasHero;
		},
		toggleSquadCombos(element) {
			this.squadCombosCollapsed[element] = !this.squadCombosCollapsed[element];
		},
		showMoreCombos(element, total) {
			const current = this.squadCombosShownCount[element] || 3;
			this.squadCombosShownCount[element] = Math.min(current + 3, total);
		},
		hideCombos(element) {
			this.squadCombosShownCount[element] = 3;
		}
	}
});

app.component('draggable', VueDraggableNext.VueDraggableNext);
app.mount('#app');

window.addEventListener('DOMContentLoaded', () => {
  const hidePreloader = () => {
    const preloader = document.getElementById('preloader');
    if (preloader) preloader.classList.add('hide');
    setTimeout(() => { if (preloader) preloader.style.display = 'none'; }, 500);
  };
  
  setTimeout(hidePreloader, 500);
});