'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.AnnotationsQueryCtrl = exports.QueryOptionsCtrl = exports.ConfigCtrl = exports.QueryCtrl = exports.Datasource = undefined;

var _datasource = require('./datasource');

var _query_ctrl = require('./query_ctrl');

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var HawkularConfigCtrl = function HawkularConfigCtrl() {
  _classCallCheck(this, HawkularConfigCtrl);
};

HawkularConfigCtrl.templateUrl = 'partials/config.html';

var HawkularQueryOptionsCtrl = function HawkularQueryOptionsCtrl() {
  _classCallCheck(this, HawkularQueryOptionsCtrl);
};

HawkularQueryOptionsCtrl.templateUrl = 'partials/query.options.html';

var HawkularAnnotationsQueryCtrl = function HawkularAnnotationsQueryCtrl() {
  _classCallCheck(this, HawkularAnnotationsQueryCtrl);
};

HawkularAnnotationsQueryCtrl.templateUrl = 'partials/annotations.editor.html';

exports.Datasource = _datasource.HawkularDatasource;
exports.QueryCtrl = _query_ctrl.HawkularDatasourceQueryCtrl;
exports.ConfigCtrl = HawkularConfigCtrl;
exports.QueryOptionsCtrl = HawkularQueryOptionsCtrl;
exports.AnnotationsQueryCtrl = HawkularAnnotationsQueryCtrl;
//# sourceMappingURL=module.js.map
