'use strict';

System.register(['./datasource', './query_ctrl'], function (_export, _context) {
  "use strict";

  var HawkularDatasource, HawkularDatasourceQueryCtrl, HawkularConfigCtrl, HawkularQueryOptionsCtrl, HawkularAnnotationsQueryCtrl;

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
    }],
    execute: function () {
      _export('ConfigCtrl', HawkularConfigCtrl = function HawkularConfigCtrl() {
        _classCallCheck(this, HawkularConfigCtrl);
      });

      HawkularConfigCtrl.templateUrl = 'partials/config.html';

      _export('QueryOptionsCtrl', HawkularQueryOptionsCtrl = function HawkularQueryOptionsCtrl() {
        _classCallCheck(this, HawkularQueryOptionsCtrl);
      });

      HawkularQueryOptionsCtrl.templateUrl = 'partials/query.options.html';

      _export('AnnotationsQueryCtrl', HawkularAnnotationsQueryCtrl = function HawkularAnnotationsQueryCtrl() {
        _classCallCheck(this, HawkularAnnotationsQueryCtrl);
      });

      HawkularAnnotationsQueryCtrl.templateUrl = 'partials/annotations.editor.html';

      _export('Datasource', HawkularDatasource);

      _export('QueryCtrl', HawkularDatasourceQueryCtrl);

      _export('ConfigCtrl', HawkularConfigCtrl);

      _export('QueryOptionsCtrl', HawkularQueryOptionsCtrl);

      _export('AnnotationsQueryCtrl', HawkularAnnotationsQueryCtrl);
    }
  };
});
//# sourceMappingURL=module.js.map
