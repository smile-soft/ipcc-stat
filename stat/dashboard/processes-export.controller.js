(function(){

	'use strict';

	angular
		.module('app.dashboard')
		.controller('ProcessesExportController', ProcessesExportController);

	ProcessesExportController.$inject = ['$scope', '$filter', '$mdDialog', 'tables', 'begin', 'end', 'data', 'utilsService', 'debugService'];

	function ProcessesExportController($scope, $filter, $mdDialog, tables, begin, end, data, utils, debug) {

		var vm = this;

		buildExportTable(data);

		vm.tables = tables;
		vm.begin = begin;
		vm.end = end;
		vm.data = data;
		vm.initRowsNum = 100;
		vm.rowsNum = vm.initRowsNum;
		vm.loadMore = function() {
			vm.rowsNum += 500;
		};

		debug.log('ProcessesExportController: ', vm.data);

		vm.order = 'date';
		vm.search = '';
		vm.filter = {
			callresult: ''
		};

		vm.exportName = 'processes';
		// vm.exportName = $filter('date')(vm.begin, 'dd.MM.yy') + '-' + $filter('date')(vm.end, 'dd.MM.yy');

		vm.filterByResult = function(actual, expected) {
			return vm.filter.callresult ? (actual.callresult.toString() === vm.filter.callresult) : true;

		};

		vm.close = function(){
			$mdDialog.hide();
		};

		function buildExportTable(data) {

			var tableExists = false,
				tableId = 'proc-export-table',
				table = document.getElementById('proc-export-table');

			if(table) tableExists = true;

			var thead = table ? table.querySelector('thead') : document.createElement('thead'), 
				tbody = table ? table.querySelector('tbody') : document.createElement('tbody'),
				qdata, qhead;

			thead.innerHTML = ['<tr>',
								'<th>Date</th>',
								'<th>Operator</th>',
								(tables.calls.columns.customer_name ? '<th>Name</th>' : ''),
								'<th>Phone</th>',
								'<th>Login</th>',
								'<th>Category</th>',
								'<th>Subcategory</th>',
								'<th>Company</th>',
								'<th>Comment</th>',
								'<th>Call Resolution</th>',
							'</tr>'].join('');

			tbody.innerHTML = data.map(function(item) {

				return ['<tr>',
							'<td>'+item.date+'</td>',
							'<td>'+item.agent+'</td>',
							(tables.calls.columns.customer_name ? ('<td>'+item.cname+'</td>') : ''),
							'<td>'+item.phone+'</td>',
							'<td>'+(item.login !== '0' ? item.login : "")+'</td>',
							'<td>'+item.category+'</td>',
							'<td>'+item.subcategory+'</td>',
							(tables.calls.columns.company ? ('<td>'+item.description+'</td>') : ''),
							'<td>'+(item.comment ? item.comment : "")+'</td>',
							'<td>'+item.callresult+'</td>',
						'</tr>'].join('');
			}).join('');

			if(!tableExists) {
				table = document.createElement('table');

				table.style.display = 'none';
				table.id = tableId;

				table.appendChild(thead);
				table.appendChild(tbody);
				document.body.appendChild(table);
			}

			debug.log('export table', table);
		}

	}

})();