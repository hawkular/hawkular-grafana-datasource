'use strict';

System.register([], function (_export, _context) {
  "use strict";

  var HawkularConfigCtrl;

  function _classCallCheck(instance, Constructor) {
    if (!(instance instanceof Constructor)) {
      throw new TypeError("Cannot call a class as a function");
    }
  }

  return {
    setters: [],
    execute: function () {
      _export('HawkularConfigCtrl', HawkularConfigCtrl = function HawkularConfigCtrl() {
        _classCallCheck(this, HawkularConfigCtrl);

        this.current.url = this.current.url || 'http://your_server:8080/hawkular';
      });

      _export('HawkularConfigCtrl', HawkularConfigCtrl);

      HawkularConfigCtrl.templateUrl = 'partials/config.html';
    }
  };
});
//# sourceMappingURL=config_ctrl.js.map
