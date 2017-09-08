'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.AnnotationsQueryCtrl = exports.QueryOptionsCtrl = exports.ConfigCtrl = exports.QueryCtrl = exports.Datasource = undefined;

var _datasource = require('./datasource');

var _query_ctrl = require('./query_ctrl');

var _config_ctrl = require('./config_ctrl');

var _annotation_ctrl = require('./annotation_ctrl');

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var HawkularQueryOptionsCtrl = function HawkularQueryOptionsCtrl() {
  _classCallCheck(this, HawkularQueryOptionsCtrl);
};

HawkularQueryOptionsCtrl.templateUrl = 'partials/query.options.html';

exports.Datasource = _datasource.HawkularDatasource;
exports.QueryCtrl = _query_ctrl.HawkularDatasourceQueryCtrl;
exports.ConfigCtrl = _config_ctrl.HawkularConfigCtrl;
exports.QueryOptionsCtrl = HawkularQueryOptionsCtrl;
exports.AnnotationsQueryCtrl = _annotation_ctrl.HawkularAnnotationsQueryCtrl;
//# sourceMappingURL=module.js.map
