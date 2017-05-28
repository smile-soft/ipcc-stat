(function(){

	'use strict';

	angular
		.module('app.dashboard')
		.controller('DashController', DashController);

	DashController.$inject = ['$rootScope', '$scope', '$timeout', '$q', '$mdMedia', '$mdBottomSheet', '$mdDialog', '$mdToast', 'store', 'SettingsService', 'apiService', 'spinnerService', 'chartService', 'debugService', 'errorService', 'utilsService'];

	function DashController($rootScope, $scope, $timeout, $q, $mdMedia, $mdBottomSheet, $mdDialog, $mdToast, store, SettingsService, api, spinnerService, chartService, debug, errorService, utils) {

		var vm = this;
		var defaultData = {
			Incoming_Agent: {
				kind: 1,
				tasks: [],
				list: [],
				sl: 20,
				metrics: ['aht', 'att', 'nco', 'nca', 'car', 'asa']
			},
			Messaging_Chat: {
				kind: 7,
				tasks: [],
				list: [],
				sl: 5,
				metrics: ['aht', 'att', 'nco', 'nca', 'car']
			},
			Autodial_Agent: {
				kind: 129,
				tasks: [],
				list: [],
				metrics: ['aht', 'att', 'nco', 'nca']
			},
			defaults: {
				tasks: [],
				list: [],
				sl: 20,
				metrics: ['aht', 'att', 'nco', 'nca', 'car']
			}
				
		},
		defaultOptions = {
			autoupdate: false,
			updateEvery: '1 minutes',
			kinds: [{name: 'Incoming_Agent', kind: 1}],
			kindsList: [{name: 'Incoming_Agent', kind: 1}, {name: 'Messaging_Chat', kind: 7}, {name: 'Autodial_Agent', kind: 129}],
			// kinds: [1, 7, 129],
			sl: [5, 10, 15, 20, 25, 30, 35, 40],
			db: {},
			tables: [],
			period: '1 day',
			catColours: [],
			catorder: 'catdesc' // changed during the dashboard initiation to the value from the config file
		},
		updateTimeout = null;

		vm.options = getDefaultOptions();
		vm.data = getDefaultData();
		vm.begin = utils.periodToRange(vm.options.period).begin;
		vm.end = utils.periodToRange(vm.options.period).end;
		vm.stat = {};
		vm.prevstat = {};
		vm.catstat = [];
		vm.globalCr = {};
		vm.globalFcr = {};
		vm.prevGlobalFcr = {};
		// vm.catTotals = {};
		// vm.subcatTotals = {};
		vm.selectedCat = null;
		vm.subCatsStat = [];
		vm.catchartData = {};
		vm.catchartLabel = 'nca';
		vm.chartOptions = {
			layout: {
				padding: {
					left: 40,
					right: 40
				}
			}
		};
		vm.catMetrics = [{ index: 'nca', name: 'Number of calls answered' }, { index: 'aht', name: 'Average handle time' }, { index: 'att', name: 'Average talk time' }];
		vm.totalByCategory = {};
		vm.userFullScreen = $mdMedia('xs');
		vm.abRate = utils.getAbandonmentRate;
		// vm.getFriendlyKind = getFriendlyKind;
		vm.openDashSettings = openDashSettings;
		vm.onCatSelect = onCatSelect;
		vm.onSubCatSelect = onSubCatSelect;
		vm.getStat = getStat;
		vm.openSettings = openSettings;
		vm.exportDash = exportDash;

		$scope.$watch(function() {
			return vm.options;
		}, function(newValue, prevValue) {
			debug.log('Options changed!!!', newValue);
			store.set('options', newValue);
		});
		$scope.$watch(function() {
			return vm.catchartLabel;
		}, function(newValue, prevValue) {
			if(vm.selectedCat)
				vm.catchartData = chartService.setChartData(vm.subCatsStat, vm.catchartLabel, vm.options.db.tables.subcategories.columns.description, vm.catchartLabel);
			else
				if(vm.options.db.tables) vm.catchartData = chartService.setChartData(vm.catstat, vm.catchartLabel, vm.options.db.tables.categories.columns.description, vm.catchartLabel);
		});
		$scope.$on('$destroy', function() {
			$timeout.cancel(updateTimeout);
			updateTimeout = null;
		});

		// Get DB settings and init the Dashboard
		SettingsService.getSettings()
		.then(function(dbSettings){
			debug.log('DB settings', dbSettings);
			var tables = dbSettings.tables,
				options = {
					db: dbSettings,
					tablesList: [],
					callstable: tables.calls ? tables.calls : null,
					cattable: tables.categories ? tables.categories : null,
					subcattable: tables.subcategories ? tables.subcategories : null,
					catorder: tables.categories ? tables.categories.columns.description : null
				};

			angular.extend(vm.options, options);
			angular.forEach(tables, function(item){
				if(item.name) vm.options.tablesList.push(item.name);
			});
			
			init();
			autoUpdate();
		});

		function init(){
			if(!vm.options.kinds.length) return spinnerService.hide('main-loader');

			vm.options.kinds.forEach(function(item, index, array) {
				api.getTasks({ kind: item.kind })
				.then(function(result) {
					return setTasks(result, item);
				})
				.then(function(tasks) {
					return getStatData(vm.data[item.name].list || tasks, item);
				})
				.then(function(){
					if(vm.options.callstable && vm.options.callstable.columns.callresult) {
						return getCallResolutionStat();
					} else {
						return $q.defer().resolve();
					}
				})
				.then(function() {
					if(vm.options.callstable && vm.options.callstable.columns.login) {
						debug.log('vm.options.callstable.columns.login: ', vm.options.callstable.columns.login);
						return getLoginsRatio();
					} else {
						return $q.defer().resolve();
					}
				})
				.then(function() {
					if(vm.options.cattable) {
						return getCategoriesStat();
					} else {
						return $q.defer().resolve();
					}
				})
				.then(getGlobalFrc)
				.then(function(){
					if(index === array.length-1) spinnerService.hide('main-loader');
				})
				.catch(errorService.show);
			});
		}

		function autoUpdate(){
			var dur = vm.options.updateEvery.split(' ');
			updateTimeout = $timeout(function() {
				if(vm.options.autoupdate) vm.getStat();
				autoUpdate();
			}, moment.duration(parseInt(dur[0], 10), dur[1])._milliseconds);
		}

		function getStat(kinds) {
			var kindsList = kinds || vm.options.kinds;
			kindsList.forEach(function(item) {
				spinnerService.show(item.name+'-loader');
				getStatData(vm.data[item.name].list, item)
				.then(function(){
					if(vm.options.callstable && vm.options.callstable.columns.callresult) {
						return getCallResolutionStat();
					} else {
						return $q.defer().resolve();
					}
				})
				.then(function() {
					if(vm.options.callstable && vm.options.callstable.columns.login) {
						debug.log('vm.options.callstable.columns.login: ', vm.options.callstable.columns.login);
						return getLoginsRatio();
					} else {
						return $q.defer().resolve();
					}
				})
				.then(getGlobalFrc)
				.then(function(){ spinnerService.hide(item.name+'-loader'); })
				.catch(function(){ spinnerService.hide(item.name+'-loader'); });
			});

			if(vm.options.cattable) getCategoriesStat();

			$mdToast.show(
				$mdToast.simple()
					.textContent('Updating indexes')
					.position('top right')
					.hideDelay(2000)
			);
		}

		function openDashSettings($event) {
			$mdDialog.show({
				targetEvent: $event,
				templateUrl: 'dashboard/dash-settings.html',
				controller: 'DashSettingsController',
				controllerAs: 'dashSetVm',
				parent: angular.element(document.body),
				locals: {
					options: vm.options
				},
				fullscreen: vm.userFullScreen
			}).then(function(result) {
				spinnerService.show('main-loader');
				vm.options = result.options;
				init();
			});
		}

		function onCatSelect(cat, index) {
			if(vm.selectedCat && (!cat || cat[vm.options.callstable.columns.category] === vm.selectedCat[vm.options.callstable.columns.category])) {
				vm.selectedCat = null;
				vm.subCatsStat = [];
				vm.catchartData = chartService.setChartData(vm.catstat, vm.catchartLabel, vm.options.db.tables.categories.columns.description, vm.catchartLabel);
				return;
			}
			else vm.selectedCat = cat;

			getSubCategoriesStat(cat[vm.options.callstable.columns.category])
			.then(function(result) {
				var data = result.data, totals = {};
				if(data.error) return errorService.show(data.error.message);
				// if(!data.result.length) return;

				// vm.subcatTotals = data.result.reduce(utils.getTotals);
				vm.subCatsStat = data.result.length ? setCatsStat(data.result, data.result.reduce(utils.getTotals)) : data.result;
				vm.catchartData = chartService.setChartData(vm.subCatsStat, vm.catchartLabel, vm.options.db.tables.subcategories.columns.description, vm.catchartLabel);
			})
			.catch(errorService.show);
		}

		function onSubCatSelect(cat, subcat, index) {
			var tables = vm.options.db.tables,
				tcols = tables.calls.columns,
				columns = [tcols.operator, tcols.customer_phone, tcols.calldate, tcols.comments],
				data;

			debug.log('onSubCatSelect: ', cat, subcat, index);

			if(tables.calls.columns.company) columns.push(tables.companies.columns.description);
			if(tables.calls.columns.customer_name) columns.push(tables.calls.columns.customer_name);
			if(tables.calls.columns.callresult) columns.push(tables.calls.columns.callresult);

			getCatProcesses(columns, cat, subcat).then(function(result) {
				data = result.data;
				if(data.error) return errorService.show(data.error.message);
				vm.processes = utils.queryToObject(data.result, columns);
				$mdDialog.show({
					templateUrl: 'dashboard/export-processes.html',
					locals: {
						tables: vm.options.db.tables,
						begin: vm.begin,
						end: vm.end,
						data: vm.processes
					},
					controller: 'ProcessesExportController',
					controllerAs: 'procExpVm',
					parent: angular.element(document.body),
					fullscreen: vm.userFullScreen
				});
			});
		}

		function openSettings($event, kind) {
			var data = vm.data[kind.name];
			$mdDialog.show({
				targetEvent: $event,
				templateUrl: 'dashboard/kind-settings.html',
				controller: 'KindSettingsController',
				controllerAs: 'kindSetVm',
				locals: {
					kind: kind,
					list: data.list,
					tasks: data.tasks,
					kindMetrics: data.metrics,
					metrics: defaultData[kind.name].metrics,
					sl: data.sl || null,
					defaultSL: vm.options.sl
				},
				parent: angular.element(document.body),
				fullscreen: vm.userFullScreen
			}).then(function(opts) {
				if(opts.sl) data.sl = opts.sl;
				data.metrics = opts.metrics;
				data.list = opts.list;

				// Update data
				vm.getStat([kind]);

				// Save new data to storage
				store.set('data', vm.data);
			});
		}

		function exportDash($event, kinds) {
			$mdDialog.show({
				targetEvent: $event,
				templateUrl: 'dashboard/export-dialog.html',
				locals: {
					kinds: kinds || vm.options.kinds,
					data: vm.data,
					tables: vm.options.db.tables,
					begin: vm.begin,
					end: vm.end,
					stat: vm.stat,
					prevstat: vm.prevstat,
					catstat: vm.catstat
				},
				controller: 'DashExportController',
				controllerAs: 'dashExpVm',
				parent: angular.element(document.body),
				fullscreen: vm.userFullScreen
			});
		}

		function getDefaultData(){
			var data = store.get('data');
			if(!data) {
				data = defaultData;
				store.set('data', data);
			}
			return data;
		}

		function getDefaultOptions(){
			var options = store.get('options');
			if(!options) {
				options = defaultOptions;
			}
			return options;
		}

		function getTasksStatistics(params, obj){
			return api.getTaskGroupStatistics(params).then(function(result) {
				var data = result.data;

				if(data.error) return errorService.show(data.error.message);
				if(data.result.length) angular.extend(obj, data.result.reduce(utils.extendAndSum));
			});
		}

		function getStatData(tasks, kind){
			return $q(function(resolve, reject) {
				// if(!tasks.length) return reject();

				var currParams = {},
					prevParams = {},
					fkind = kind.name,
					data = vm.data[fkind],
					metrics = data.metrics || vm.data[fkind].metrics,
					slIndex = utils.getSlIndex(metrics);

				currParams = {
					begin: new Date(vm.begin).valueOf(),
					end: new Date(vm.end).valueOf(),
					list: tasks,
					metrics: metrics
				};

				if(data.sl && slIndex === -1) {
					currParams.metrics.push('sl'+data.sl);
				} else if(data.sl && metrics[slIndex] !== 'sl'+data.sl) {
					currParams.metrics[slIndex] = 'sl'+data.sl;
				}

				angular.extend(prevParams, currParams);
				prevParams.begin = currParams.begin - (currParams.end - currParams.begin);
				prevParams.end = currParams.begin;
				
				vm.stat[fkind] = tasks.length ? (vm.stat[fkind] || {}) : {};
				vm.prevstat[fkind] = tasks.length ? (vm.prevstat[fkind] || {}) : {};

				getTasksStatistics(currParams, vm.stat[fkind]).then(function(){
					return getTasksStatistics(prevParams, vm.prevstat[fkind]);
				}).then(function(){
					resolve();
				});

			});
		}

		/**
		 * Save array of tasks to scope variables
		 * @param {Object} result - object, which is returned from getTasks query or an array of tasks
		 */
		function setTasks(result, kind){
			var data = result.data,
				tasks = data ? data.result : result,
				fkind = kind.name;

			return $q(function(resolve, reject) {
				if(data && data.err) return reject(data.err.message);
				if(!tasks) return reject('Tasks is undefined');

				if(!vm.data[fkind]) {
					vm.data[fkind] = defaultData.defaults;
				}
				vm.data[fkind].tasks = [].concat(tasks);
				if(!vm.data[fkind].list.length) vm.data[fkind].list = [].concat(tasks);

				resolve(tasks);
			});
		}

		function getCategoriesStat(){
			var data, tables = vm.options.db.tables,
			metrics = ['nca', 'att', 'aht', 'asa', 'sl'+vm.data.Incoming_Agent.sl];
			
			if(tables.calls.columns.callresult) {
				metrics.push('sum(callresult)');
				// vm.catMetrics.push({ index: 'sum(callresult)', name: 'Call resolution' });
			}

			vm.options.tablesList = [tables.calls.name, tables.categories.name];
			// if(tables.companies) vm.options.tablesList.push(tables.companies.name);

			spinnerService.show('categories-loader');
			api.getCustomListStatistics({
				// tables: ['probstat', 'probcat', 'probcompany'],
				tables: vm.options.tablesList,
				// tabrel: 'probstat.probcat=probcat.catid and probstat.probcompany=probcompany.compid',
				tabrel: [tables.calls.name, tables.calls.columns.category].join('.')+'='+[tables.categories.name, tables.categories.columns.id].join('.')+
						// ' and tasktype in ('+getTaskKinds().join(',')+')'+
						' and taskid in (\''+getTaskIds().join('\',\'')+'\')'+
						' and '+[tables.calls.name, tables.calls.columns.operator].join('.')+'=processed.agentid',
						// (tables.calls.columns.company ?
						// ' and '+[tables.calls.name, tables.calls.columns.company].join('.')+'='+[tables.companies.name, tables.companies.columns.id].join('.') :
						// ''),
				procid: [tables.calls.name, tables.calls.columns.process_id].join('.'),
				columns: [tables.calls.columns.category, tables.categories.columns.description],
				// columns: [tables.calls.columns.category, tables.categories.columns.description],
				begin: vm.begin.valueOf(),
				end: vm.end.valueOf(),
				metrics: metrics
			})
			.then(function(result) {
				
				spinnerService.hide('categories-loader')

				data = result.data;
				if(data.error) return errorService.show(data.error.message);
				
				// vm.catTotals = data.result.reduce(utils.getTotals);
				vm.catstat = data.result.length ? setCatsStat(data.result, data.result.reduce(utils.getTotals)) : data.result;
				debug.log('getCategoriesStat catstat: ', vm.catstat);
				vm.catchartData = chartService.setChartData(vm.catstat, vm.catchartLabel, tables.categories.columns.description, vm.catchartLabel);
				debug.log('getCategoriesStat vm.catchartData: ', vm.catchartData);
				spinnerService.hide('categories-loader');
			})
			.catch(errorService.show);

		}

		function getSubCategoriesStat(cat){
			var data, tables = vm.options.db.tables,
			metrics = ['nca', 'att', 'aht', 'asa', 'sl'+vm.data.Incoming_Agent.sl];
			if(tables.calls.columns.callresult) metrics.push('sum(callresult)');

			spinnerService.show('categories-loader');
			return api.getCustomListStatistics({
				// tables: ['probstat', 'probcat', 'probdetails'],
				tables: [tables.calls.name, tables.categories.name, tables.subcategories.name],
				// tabrel: 'probcat.catdesc="'+cat+'" and probstat.probcat=probcat.catid and probstat.probdetails=probdetails.subid',
				tabrel: [tables.categories.name, tables.categories.columns.id].join('.')+'='+cat+
						// ' and tasktype in ('+getTaskKinds().join(',')+')'+
						' and taskid in (\''+getTaskIds().join('\',\'')+'\')'+
						' and '+[tables.calls.name, tables.calls.columns.operator].join('.')+'=processed.agentid'+
						' and '+[tables.calls.name, tables.calls.columns.category].join('.')+'='+[tables.categories.name, tables.categories.columns.id].join('.')+
						' and '+[tables.calls.name, tables.calls.columns.subcategory].join('.')+'='+[tables.subcategories.name, tables.subcategories.columns.id].join('.'),
				procid: [tables.calls.name, tables.calls.columns.process_id].join('.'),
				columns: [tables.subcategories.columns.id, tables.subcategories.columns.description],
				begin: vm.begin.valueOf(),
				end: vm.end.valueOf(),
				metrics: metrics
			}).then(function(result){
				debug.log('getSubCategoriesStat data: ', result.data);
				spinnerService.hide('categories-loader');
				return result;
			});
		}

		function getCatProcesses(columns, cat, subcat){
			if(!columns) return;
			var tables = vm.options.db.tables;
			vm.options.tablesList = [tables.processed.name, tables.calls.name, tables.categories.name, tables.subcategories.name];
			if(tables.companies) vm.options.tablesList.push(tables.companies.name);

			spinnerService.show('categories-loader');
			return api.getQueryResultSet({
				// tables: ['processed', 'probstat', 'probcat', 'probdetails', 'probcompany'],
				tables: vm.options.tablesList,
				// tabrel: (cat ? 'probcat.catdesc="'+cat+'" and ' : '') + (subcat ? 'probdetails.probdesc="'+subcat+'" and ' : '') + 'probstat.probcat=probcat.catid and probstat.probdetails=probdetails.subid and probstat.probcompany=probcompany.compid',
				tabrel: (cat !== undefined ? [tables.categories.name, tables.categories.columns.id].join('.')+'='+cat+' and ' : '') +
						' taskid in (\''+getTaskIds().join('\',\'')+'\')'+
						' and '+[tables.calls.name, tables.calls.columns.operator].join('.')+'=processed.agentid '+
						(subcat !== undefined ? ' and '+[tables.subcategories.name, tables.subcategories.columns.id].join('.')+'='+subcat : '') +
						' and '+[tables.calls.name, tables.calls.columns.category].join('.')+'='+[tables.categories.name, tables.categories.columns.id].join('.')+
						(tables.calls.columns.subcategory !== undefined ? ' and '+[tables.calls.name, tables.calls.columns.subcategory].join('.')+'='+[tables.subcategories.name, tables.subcategories.columns.id].join('.') : '')+
						(tables.calls.columns.company !== undefined ? ' and '+[tables.calls.name, tables.calls.columns.company].join('.')+'='+[tables.companies.name, tables.companies.columns.id].join('.') : '') +
						' and processed.procid='+[tables.calls.name, tables.calls.columns.process_id].join('.'),
				columns: columns,
				// groupBy: tables.calls.columns.comments,
				begin: vm.begin.valueOf(),
				end: vm.end.valueOf()
			}).then(function(result){
				spinnerService.hide('categories-loader');
				return result;
			});
		}

		function getCallResolutionStat(){
			var data, tables = vm.options.db.tables, taskKind = 1,
			metrics = ['count(callresult)'];

			return api.getCustomListStatistics({
				tables: [tables.calls.name],
				// tabrel: 'probstat.probcat=probcat.catid and probstat.probcompany=probcompany.compid',
				tabrel: 'taskid in (\''+getTaskIds([taskKind]).join('\',\'')+'\')'+
						'and '+[tables.calls.name, tables.calls.columns.callresult].join('.')+' = 1',
				procid: [tables.calls.name, tables.calls.columns.process_id].join('.'),
				columns: [tables.calls.columns.callresult],
				// columns: [tables.calls.columns.category, tables.categories.columns.description],
				begin: vm.begin.valueOf(),
				end: vm.end.valueOf(),
				metrics: metrics
			}).then(function(result){
				debug.log('getCallResolutionStat data: ', result.data);
				if(result.data.result.length) {
					vm.globalCr[utils.getFriendlyKind(taskKind)] = result.data.result[0]['count(callresult)'];
					debug.log('globalCr: ', vm.globalCr[utils.getFriendlyKind(taskKind)]);
					return result;
				}
			});
		}

		function getGlobalFrc() {
			var tables = vm.options.db.tables,
				taskKind = 1,
				tasks = getTaskIds([taskKind]);

			debug.log('getGlobalFrc tasks:', tasks[0]);

			return api.getCustomFCRStatistics({
				task: tasks[0],
				// table: [tables.calls.name],
				// procid: tables.calls.columns.process_id,
				interval: 3600*24*1000,
				begin: vm.begin.valueOf(),
				end: vm.end.valueOf()
			})
			.then(function(result) {
				vm.globalFcr = result.data.result.length ? (result.data.result
				.reduce(utils.extendAndSum)) : [];
				
				vm.globalFcr.fcrRate = vm.globalFcr.fcr / vm.globalFcr.total * 100;

				debug.log('getGlobalFrc: ', vm.globalFcr);

				// get prev statistics
				return api.getCustomFCRStatistics({
					task: tasks[0],
					// table: [tables.calls.name],
					// procid: tables.calls.columns.process_id,
					interval: 3600*24*1000,
					begin: (vm.begin.valueOf() - (vm.end.valueOf() - vm.begin.valueOf())),
					end: vm.begin.valueOf()
				});

			})
			.then(function(result) {
				vm.prevGlobalFcr = result.data.result.length ? (result.data.result
				.reduce(utils.extendAndSum)) : [];
				
				vm.prevGlobalFcr.fcrRate = vm.prevGlobalFcr.fcr / vm.prevGlobalFcr.total * 100;

				debug.log('prevGlobalFcr: ', vm.prevGlobalFcr);
			})
		}

		function getLoginsRatio() {
			var data, tables = vm.options.db.tables, taskKind = 1,
			rdata = {},
			metrics = ['count(login)'];
			// metrics = ['count(case when login != 0 then login else null end) as tlogins'];

			return api.getCustomListStatistics({
				tables: [tables.calls.name],
				// tabrel: 'probstat.probcat=probcat.catid and probstat.probcompany=probcompany.compid',
				tabrel: 'taskid in (\''+getTaskIds([taskKind]).join('\',\'')+'\')' +
						"and "+[tables.calls.name, tables.calls.columns.login].join('.')+" != '0'",
				procid: [tables.calls.name, tables.calls.columns.process_id].join('.'),
				columns: [tables.calls.columns.callresult],
				// columns: [tables.calls.columns.category, tables.categories.columns.description],
				begin: vm.begin.valueOf(),
				end: vm.end.valueOf(),
				metrics: metrics
			}).then(function(result){
				debug.log('getLoginsRatio data: ', result.data);
				if(result.data && result.data.result && result.data.result.length) {
					rdata = result.data.result;
					vm.stat = vm.stat || {};
					vm.stat[utils.getFriendlyKind(taskKind)] = vm.stat[utils.getFriendlyKind(taskKind)] || {};
					vm.stat[utils.getFriendlyKind(taskKind)].ncu = rdata.reduce(function(prev, next) { 
						return prev + next['count(login)']; 
					}, 0);
					
					debug.log('getLoginsRatio stat: ', vm.stat[utils.getFriendlyKind(taskKind)]);
					return result;
				}
			});
		}

		function setCatsStat(data, totals){
			var dataValue;
				// totals = data.reduce(utils.getTotals);

			return utils.setPercentageValues(data, totals).map(function(item){
				angular.forEach(item, function(value, key){
					dataValue = parseFloat(value);

					if(!isNaN(dataValue)) item[key] = dataValue;
				});
				return item;
			});
		}

		// function setChartData(array, datakey, labelkey){
		// 	var newArray = [], data = [], labels = [], colours = [], itemData;

		// 	sortObjBy(array, datakey, 'descend')
		// 	.map(function(item){
		// 		data.push(angular.isNumber(item[datakey]) ? item[datakey].toFixed(2) : item[datakey] );
		// 		labels.push(item[labelkey]);
		// 		colours.push(getCategoryColour(item[labelkey]));
		// 	});
			
			
		// 	store.set('options', vm.options);

		// 	return {
		// 		data: data,
		// 		labels: labels,
		// 		colours: colours
		// 	};
		// }

		// function getCategoryColour(cat){
		// 	var catColours = vm.options.catColours,
		// 		found = false, colour = '';

		// 	catColours.forEach(function(item){
		// 		if(item.name === cat) found = item;
		// 	});

		// 	if(found) {
		// 		colour = found.colour;
		// 	} else {
		// 		colour = colourGenerator.getColor();
		// 		vm.options.catColours.push({ name: cat, colour: colour });
		// 	}
		// 	return colour;
		// }


		// function sortObjBy(array, key, descend){
		// 	var sorted = array.sort(function(a, b){
		// 		if(a[key] > b[key]) return descend ? -1 : 1;
		// 		if(a[key] < b[key]) return descend ? 1 : -1;
		// 		return 0;
		// 	});
		// 	return sorted;
		// }

		function getTaskKinds(){
			return vm.options.kinds.map(function(item){ return item.kind; });
		}

		function getTaskIds(kinds){
			var ids = [];
			angular.forEach(vm.data, function(value, key){
				if(value.list.length) {
					if(kinds) {
						if(kinds.indexOf(value.kind) > -1) ids.push(value.list);
					} else {
						ids.push(value.list);
					}
				}
			});

			if(ids.length) {
				return ids.reduce(function(prev, curr){
					return prev.concat(curr);
				});
			} else {
				return ids;
			}
		}

	}

})();