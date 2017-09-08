'use strict';

System.register(['./datasource', './query_ctrl', './config_ctrl', './annotation_ctrl'], function (_export, _context) {
  "use strict";

  var HawkularDatasource, HawkularDatasourceQueryCtrl, HawkularConfigCtrl, HawkularAnnotationsQueryCtrl, HawkularQueryOptionsCtrl;

  function _classCallCheck(instance, Constructor) {
    if (!(instance instanceof Constructor)) {
      throw new TypeError("Cannot call a class as a function");
    }
  }

  return {
    setters: [function (_datasource) {
      HawkularDatasource = _datasource.HawkularDatasource;
    }, function (_query_ctrl) {
      HawkularDatasourceQueryCtrl = _query_ctrl.HawkularDatasourceQueryCtrl;
    }, function (_config_ctrl) {
      HawkularConfigCtrl = _config_ctrl.HawkularConfigCtrl;
    }, function (_annotation_ctrl) {
      HawkularAnnotationsQueryCtrl = _annotation_ctrl.HawkularAnnotationsQueryCtrl;
    }],
    execute: function () {
      _export('QueryOptionsCtrl', HawkularQueryOptionsCtrl = function HawkularQueryOptionsCtrl() {
        _classCallCheck(this, HawkularQueryOptionsCtrl);
      });

      HawkularQueryOptionsCtrl.templateUrl = 'partials/query.options.html';

      _export('Datasource', HawkularDatasource);

      _export('QueryCtrl', HawkularDatasourceQueryCtrl);

      _export('ConfigCtrl', HawkularConfigCtrl);

      _export('QueryOptionsCtrl', HawkularQueryOptionsCtrl);

      _export('AnnotationsQueryCtrl', HawkularAnnotationsQueryCtrl);
    }
  };
});
//# sourceMappingURL=module.js.map
