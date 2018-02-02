'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.DeferredUpdater = undefined;

var _promise = require('babel-runtime/core-js/promise');

var _promise2 = _interopRequireDefault(_promise);

var _asyncToGenerator2 = require('babel-runtime/helpers/asyncToGenerator');

var _asyncToGenerator3 = _interopRequireDefault(_asyncToGenerator2);

exports.resolveParameterNames = resolveParameterNames;
exports.requestSSMParameters = requestSSMParameters;
exports.getDistinctParameters = getDistinctParameters;
exports.monitorParams = monitorParams;
exports.getVars = getVars;
exports.setupEnvironment = setupEnvironment;

var _awsSdk = require('aws-sdk');

var _awsSdk2 = _interopRequireDefault(_awsSdk);

var _Rx = require('rxjs/Rx');

var _Rx2 = _interopRequireDefault(_Rx);

var _ava = require('ava');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const SSM = new _awsSdk2.default.SSM({});

/**
 * Resolves parameter names from 
 * @param {*} stage 
 */
function resolveParameterNames(stage) {
    return obs => {
        return obs.map(({ name, repo, env }) => ({
            name: `/${repo}/${stage}/${name}`,
            env
        }));
    };
}

/**
 * Given a stream of parameter names get parameters form SSM.
 * 
 * @param {Observable<>} obs list of  strings containing parameters to get from SSM 
 */

function requestSSMParameters(obs) {
    return obs.map(ii => ii.name).toArray().flatMap(ii => SSM.getParameters({
        Names: ii,
        WithDecryption: true
    }).promise()).flatMap(ii => _Rx2.default.Observable.from(ii.Parameters)).map(ii => {
        return { name: ii.Name, value: ii.Value };
    });
}

function getSingleParameter(name) {
    SSM.getParameter({
        Name: name, WithDecryption: true
    }).then(ii => ii.Parameter.Value);
}

function getFnCurrentVarValue(parameters, stage) {
    var paramMap = _Rx2.default.Observable.from(parameters).let(getDistinctParameters(stage)).reduce((rr, ii) => {
        rr[ii.env] = ii.name;
        return rr;
    }, {}).toPromise();
    return (() => {
        var _ref = (0, _asyncToGenerator3.default)(function* (env) {
            var name = (yield paramMap)[env];
            return getSingleParameter(name);
        });

        return function (_x) {
            return _ref.apply(this, arguments);
        };
    })();
}

function getDistinctParameters(stage) {

    return obs => {
        let parameterNames = obs.let(resolveParameterNames(stage)).share();

        return parameterNames.let(requestSSMParameters).concat(parameterNames).groupBy(ii => ii.name).flatMap(ii => ii.reduce((rr, ii) => {
            rr.name = ii.name;
            rr.value = ii.value || rr.value;
            rr.env = ii.env || rr.env;
            return rr;
        }, {})).reduce((rr, { env, value, name }) => {
            rr[env] = value;
            return rr;
        }, {});
    };
}

function monitorParams(time, parameters, stage) {
    return _Rx2.default.Observable.interval(time).flatMap(ii => _Rx2.default.Observable.from(parameters).let(getDistinctParameters(stage))).distinctUntilChanged();
}

class DeferredUpdater {
    constructor() {
        this._promise = new _promise2.default((resolve, reject) => {
            this.reject = reject;
            this.resolve = ii => {
                this.value = ii;
                resolve(ii);
            };
        });
        this.promise = () => this._promise.then(() => def.value);
    }
}

exports.DeferredUpdater = DeferredUpdater;
function getVars({ interval, stage, parameters }) {
    const def = new DeferredUpdater();
    monitorParams(interval, parameters, stage).subscribe(ii => def.resolve({
        env: ii
    }));
    return def;
}

// Environment can change mid request.

var updateMap = {};

/**
 * setupEnvironment
 * 
 */

function setupEnvironment({ interval, stage, parameters, onUpdate = () => {} }, init) {
    const def = new DeferredUpdater();
    const monitor = monitorParams(interval, parameters, stage);
    const getCurrentVarValue = getFnCurrentVarValue(parameters, stage);
    monitor.subscribe(ii => def.resolve({
        fn: (() => {
            onUpdate(ii);
            return init(ii, {
                getCurrentVarValue
            });
        })()
    }));
    return (event, context, cb) => def.promise.then(({ fn }) => fn(event, context, cb));
}