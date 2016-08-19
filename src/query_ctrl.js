import {QueryCtrl} from 'app/plugins/sdk';
import './css/query-editor.css!'

export class HawkularDatasourceQueryCtrl extends QueryCtrl {

  constructor($scope, $injector, uiSegmentSrv)  {
    super($scope, $injector);

    this.scope = $scope;
    this.uiSegmentSrv = uiSegmentSrv;

    this.metricTypes = [
      {value: 'gauge', text: 'Gauge'},
      {value: 'counter', text: 'Counter'}
    ];

    this.reduceFunctions = [
      {value: 'none', text: 'None'},
      {value: 'sum', text: 'Sum'},
      {value: 'average', text: 'Average'},
      {value: 'min', text: 'min'},
      {value: 'max', text: 'max'}
    ];

    this.target.type = this.target.type || 'gauge';
    this.target.target = this.target.target || 'select metric';
    this.target.rate = this.target.rate === true;
    this.target.reduce = this.target.reduce || 'none';
  }

  getOptions() {
    return this.datasource.metricFindQuery(this.target)
      .then(this.uiSegmentSrv.transformToSegments(false));
      // Options have to be transformed by uiSegmentSrv to be usable by metric-segment-model directive
  }

  onChangeInternal() {
    this.panelCtrl.refresh(); // Asks the panel to refresh data.
  }
}

HawkularDatasourceQueryCtrl.templateUrl = 'partials/query.editor.html';
