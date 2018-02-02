'use strict';

var _promise = require('babel-runtime/core-js/promise');

var _promise2 = _interopRequireDefault(_promise);

var _asyncToGenerator2 = require('babel-runtime/helpers/asyncToGenerator');

var _asyncToGenerator3 = _interopRequireDefault(_asyncToGenerator2);

var _ava = require('ava');

var _ava2 = _interopRequireDefault(_ava);

var _proxyquire = require('proxyquire');

var _proxyquire2 = _interopRequireDefault(_proxyquire);

var _Rx = require('rxjs/Rx');

var _Rx2 = _interopRequireDefault(_Rx);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var mockParameters = {
  Parameters: [{
    Name: '/test-repo/test/var1',
    Value: 'foo'
  }, {
    Name: '/test-repo/test/var2',
    Value: 'bar'
  }, {
    Name: '/test-repo/test/var3',
    Value: 'baz'
  }, {
    Name: '/test-repo2/test/var1',
    Value: 'pez'
  }]
};
var requestedParams = [{
  name: 'var1',
  repo: 'test-repo',
  env: 'VAR_1'
}, {
  name: 'var2',
  repo: 'test-repo',
  env: 'VAR_2'
}, {
  name: 'var3',
  repo: 'test-repo',
  env: 'VAR_3'
}, {
  name: 'var1',
  repo: 'test-repo2',
  env: 'VAR_4'
}];

(0, _ava2.default)('resolveParameterNames creates SSM parameter names form repositories, stages and names.', (() => {
  var _ref = (0, _asyncToGenerator3.default)(function* (t) {
    var { resolveParameterNames } = (0, _proxyquire2.default)('../index', {
      'aws-sdk': { '@noCallThru': true, SSM: function () {} }
    });

    var result = _Rx2.default.Observable.from(requestedParams).let(resolveParameterNames('test')).toArray().toPromise();

    t.deepEqual((yield result), [{ name: '/test-repo/test/var1', env: 'VAR_1' }, { name: '/test-repo/test/var2', env: 'VAR_2' }, { name: '/test-repo/test/var3', env: 'VAR_3' }, { name: '/test-repo2/test/var1', env: 'VAR_4' }]);
  });

  return function (_x) {
    return _ref.apply(this, arguments);
  };
})());

(0, _ava2.default)('requestSSMParameters, requests parameters from SSM', (() => {
  var _ref2 = (0, _asyncToGenerator3.default)(function* (t) {
    var { requestSSMParameters } = (0, _proxyquire2.default)('../index', {
      'aws-sdk': {
        '@noCallThru': true,
        SSM: function () {
          return { getParameters: (params, cb) => {
              return {
                promise: () => {
                  return _promise2.default.resolve(mockParameters);
                }
              };
            }
          };
        }
      }
    });
    var expectedResult = [{
      name: '/test-repo/test/var1',
      value: 'foo'
    }, {
      name: '/test-repo/test/var2',
      value: 'bar'
    }, {
      name: '/test-repo/test/var3',
      value: 'baz'
    }, {
      name: '/test-repo2/test/var1',
      value: 'pez'
    }];
    var result = _Rx2.default.Observable.from([{ name: '/test-repo/test/var1', env: 'VAR_1' }, { name: '/test-repo/test/var2', env: 'VAR_2' }, { name: '/test-repo/test/var3', env: 'VAR_3' }, { name: '/test-repo2/test/var1', env: 'VAR_4' }]).let(requestSSMParameters).toArray().toPromise();
    t.deepEqual((yield result), expectedResult);
  });

  return function (_x2) {
    return _ref2.apply(this, arguments);
  };
})());

(0, _ava2.default)('getDistinctParameters, returns an distinct parameters from SSM', (() => {
  var _ref3 = (0, _asyncToGenerator3.default)(function* (t) {
    var { getDistinctParameters } = (0, _proxyquire2.default)('../index', {
      'aws-sdk': {
        '@noCallThru': true,
        SSM: function () {
          return { getParameters: (params, cb) => {
              return {
                promise: () => {
                  return _promise2.default.resolve(mockParameters);
                }
              };
            }
          };
        }
      }
    });
    var expectedResult = {
      'VAR_1': 'foo',
      'VAR_2': 'bar',
      'VAR_3': 'baz',
      'VAR_4': 'pez'
    };

    var result = _Rx2.default.Observable.from(requestedParams).let(getDistinctParameters('test')).toPromise();
    t.deepEqual((yield result), expectedResult);
  });

  return function (_x3) {
    return _ref3.apply(this, arguments);
  };
})());

(0, _ava2.default)('setupEnvironment, sets up an environment given SSM parameters, calls ', (() => {
  var _ref4 = (0, _asyncToGenerator3.default)(function* (t) {
    var { setupEnvironment } = (0, _proxyquire2.default)('../index', {
      'aws-sdk': {
        '@noCallThru': true,
        SSM: function () {
          return { getParameters: (params, cb) => {
              return {
                promise: () => {
                  return _promise2.default.resolve(mockParameters);
                }
              };
            }
          };
        }
      }
    });
    var expectedResult = {
      'VAR_1': 'foo',
      'VAR_2': 'bar',
      'VAR_3': 'baz',
      'VAR_4': 'pez'
    };

    var p = new _promise2.default(function (res, rej) {
      setupEnvironment({ interval: 100, stage: 'test', parameters: requestedParams }, function (env) {
        res(env.VAR_1);
        return function () {};
      });
    });
    t.is((yield p), 'foo');
  });

  return function (_x4) {
    return _ref4.apply(this, arguments);
  };
})());