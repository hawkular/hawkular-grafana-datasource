import {QueryCtrl} from 'app/plugins/sdk';
import './css/query-editor.css!'
import {Capabilities} from './capabilities';
import {TagsKVPairsController} from './tagsKVPairsController';
import {TagsQLController} from './tagsQLController';

export class HawkularDatasourceQueryCtrl extends QueryCtrl {

  constructor($scope, $injector, uiSegmentSrv, $q) {
    super($scope, $injector);

    this.scope = $scope;
    this.uiSegmentSrv = uiSegmentSrv;
    this.$q = $q;

    this.target = this.datasource.sanitizeTarget(this.target);
    this.caps = new Capabilities('');
    this.datasource.getCapabilities().then(caps => {
      this.caps = caps;
      if (caps.TAGS_QUERY_LANGUAGE) {
        this.tagsController = new TagsQLController(uiSegmentSrv, this.datasource, $q, () => this.target);
      } else {
        this.tagsController = new TagsKVPairsController(uiSegmentSrv, this.datasource, $q, caps.FETCH_ALL_TAGS, () => this.target);
      }
      this.tagsSegments = this.tagsController.initTagsSegments();
    });

    this.metricTypes = [
      {value: 'gauge', text: 'Gauge'},
      {value: 'counter', text: 'Counter'},
      {value: 'availability', text: 'Availability'}
    ];
    this.seriesAggFns = [
      {value: 'none', text: 'None'},
      {value: 'sum', text: 'Sum'},
      {value: 'avg', text: 'Average'}
    ];
    this.timeAggFns = [
      {value: 'avg', text: 'Average'},
      {value: 'min', text: 'Min'},
      {value: 'max', text: 'Max'},
      {value: 'live', text: 'Live'}
    ];
    this.availableStats = ['avg', 'min', 'max', 'median', 'sum', '75 %ile', '90 %ile', '95 %ile', '98 %ile', '99 %ile', '99.9 %ile']
      .map(val => ({value: val, text: val}));
    this.statsSegments = this.initStatsSegments();
    this.removeStatsSegment = this.uiSegmentSrv.newSegment({fake: true, value: '-- Remove --'});

    this.target.type = this.target.type || this.metricTypes[0].value;
    this.target.id = this.target.id || '-- none --';
    if (this.panel.type === 'singlestat') {
      this.target.raw = false;
      this.target.timeAggFn = this.target.timeAggFn || this.timeAggFns[0].value;
    }
  }

  getTagsSegments(segment, $index) {
    return this.tagsController.getTagsSegments(this.tagsSegments, segment, $index);
  }

  tagsSegmentChanged(segment, $index) {
    this.tagsController.tagsSegmentChanged(this.tagsSegments, segment, $index);
    this.onChangeInternal();
  }

  initStatsSegments() {
    let segments = this.target.stats.map((stat) => this.uiSegmentSrv.newKey(stat));
    segments.push(this.uiSegmentSrv.newPlusButton());
    return segments;
  }

  getStatsSegments(segment, $index) {
    if (segment.type === 'plus-button') {
      return this.getAvailableStats();
    }
    return this.getAvailableStats()
        .then(keys => [angular.copy(this.removeStatsSegment), ...keys]);
  }

  statsSegmentChanged(segment, index) {
    if (segment.value === this.removeStatsSegment.value) {
      this.statsSegments.splice(index, 1);
    } else if (segment.type === 'plus-button') {
      this.statsSegments.splice(index, 1);
      this.statsSegments.splice(index, 0,
        this.uiSegmentSrv.newKey(segment.value),
        this.uiSegmentSrv.newPlusButton());
    } else {
      this.statsSegments[index] = segment;
    }
    this.target.stats = this.statsSegments.filter((s) => !s.fake).map((s) => s.value);
    this.onChangeInternal();
  }

  getAvailableStats() {
    // Filter out already selected stats
    return this.$q.when(this.availableStats.filter((stat) => this.target.stats.indexOf(stat.value) < 0))
      .then(this.uiSegmentSrv.transformToSegments(false));
  }

  getMetricOptions() {
    return this.datasource.suggestMetrics(this.target)
      .then(metrics => [{value: '-- none --', text: '-- none --'}].concat(metrics))
      .then(this.uiSegmentSrv.transformToSegments(false));
      // Options have to be transformed by uiSegmentSrv to be usable by metric-segment-model directive
  }

  onChangeInternal() {
    if (this.target.type == 'availability') {
      // Disable multiple series aggregation
      this.target.seriesAggFn = this.seriesAggFns[0].value;
    }
    this.panelCtrl.refresh(); // Asks the panel to refresh data.
  }

  toggleEditorMode() {
    if (this.caps.TAGS_QUERY_LANGUAGE) {
      this.target.rawTagsQuery = !this.target.rawTagsQuery;
      if (!this.target.rawTagsQuery) {
        try {
          this.tagsSegments = this.tagsController.initTagsSegments();
        } catch (err) {
          this.target.rawTagsQuery = true;
          console.log('Cannot parse query: ' + err);
        }
      }
    } else {
      this.target.rawTagsQuery = false;
    }
  }
}

HawkularDatasourceQueryCtrl.templateUrl = 'partials/query.editor.html';
