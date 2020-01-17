// @flow



var util = require('util');
var _ = require('underscore');
var _str = require('underscore.string');

// var RpcCall = require('../rpc-call').RpcCall;
import RpcCall from './rpc-call';
import { stat } from 'fs';

var _ = require('underscore');
var _str = require('underscore.string');
var Socket = require('net').Socket;
var format = require('util').format;

import invariant from 'assert';

import {Connection} from './netutility';
import {Transaction} from './tx-dapp';
import {dormant} from './dormant';
import type {BvmAcct} from './bvm-acct';
import type {TxnSignature} from './tx-dapp';
import {DEFAULT_TICKS_PER_SLOT, NUM_TICKS_PER_SEC} from './timing';

var PREFIX = '[XWB]';
var RPC_VERSION = '1.108';

var NUL = '\u0000';
var SOH = '\u0001';
var EOT = '\u0004';
var ENQ = '\u0005';

var CIPHER_PAD = [
    'wkEo-ZJt!dG)49K{nX1BS$vH<&:Myf*>Ae0jQW=;|#PsO`\'%+rmb[gpqN,l6/hFC@DcUa ]z~R}"V\\iIxu?872.(TYL5_3',
    'rKv`R;M/9BqAF%&tSs#Vh)dO1DZP> *fX\'u[.4lY=-mg_ci802N7LTG<]!CWo:3?{+,5Q}(@jaExn$~p\\IyHwzU"|k6Jeb',
    '\\pV(ZJk"WQmCn!Y,y@1d+~8s?[lNMxgHEt=uw|X:qSLjAI*}6zoF{T3#;ca)/h5%`P4$r]G\'9e2if_>UDKb7<v0&- RBO.',
    'depjt3g4W)qD0V~NJar\\B "?OYhcu[<Ms%Z`RIL_6:]AX-zG.#}$@vk7/5x&*m;(yb2Fn+l\'PwUof1K{9,|EQi>H=CT8S!',
    'NZW:1}K$byP;jk)7\'`x90B|cq@iSsEnu,(l-hf.&Y_?J#R]+voQXU8mrV[!p4tg~OMez CAaGFD6H53%L/dT2<*>"{\\wI=',
    'vCiJ<oZ9|phXVNn)m K`t/SI%]A5qOWe\\&?;jT~M!fz1l>[D_0xR32c*4.P"G{r7}E8wUgyudF+6-:B=$(sY,LkbHa#\'@Q',
    'hvMX,\'4Ty;[a8/{6l~F_V"}qLI\\!@x(D7bRmUH]W15J%N0BYPkrs&9:$)Zj>u|zwQ=ieC-oGA.#?tfdcO3gp`S+En K2*<',
    'jd!W5[];4\'<C$/&x|rZ(k{>?ghBzIFN}fAK"#`p_TqtD*1E37XGVs@0nmSe+Y6Qyo-aUu%i8c=H2vJ\\) R:MLb.9,wlO~P',
    '2ThtjEM+!=xXb)7,ZV{*ci3"8@_l-HS69L>]\\AUF/Q%:qD?1~m(yvO0e\'<#o$p4dnIzKP|`NrkaGg.ufCRB[; sJYwW}5&',
    'vB\\5/zl-9y:Pj|=(R\'7QJI *&CTX"p0]_3.idcuOefVU#omwNZ`$Fs?L+1Sk<,b)hM4A6[Y%aDrg@~KqEW8t>H};n!2xG{',
    'sFz0Bo@_HfnK>LR}qWXV+D6`Y28=4Cm~G/7-5A\\b9!a#rP.l&M$hc3ijQk;),TvUd<[:I"u1\'NZSOw]*gxtE{eJp|y (?%',
    'M@,D}|LJyGO8`$*ZqH .j>c~h<d=fimszv[#-53F!+a;NC\'6T91IV?(0x&/{B)w"]Q\\YUWprk4:ol%g2nE7teRKbAPuS_X',
    '.mjY#_0*H<B=Q+FML6]s;r2:e8R}[ic&KA 1w{)vV5d,$u"~xD/Pg?IyfthO@CzWp%!`N4Z\'3-(o|J9XUE7k\\TlqSb>anG',
    'xVa1\']_GU<X`|\\NgM?LS9{"jT%s$}y[nvtlefB2RKJW~(/cIDCPow4,>#zm+:5b@06O3Ap8=*7ZFY!H-uEQk; .q)i&rhd',
    'I]Jz7AG@QX."%3Lq>METUo{Pp_ |a6<0dYVSv8:b)~W9NK`(r\'4fs&wim\\kReC2hg=HOj$1B*/nxt,;c#y+![?lFuZ-5D}',
    'Rr(Ge6F Hx>q$m&C%M~Tn,:"o\'tX/*yP.{lZ!YkiVhuw_<KE5a[;}W0gjsz3]@7cI2\\QN?f#4p|vb1OUBD9)=-LJA+d`S8',
    'I~k>y|m};d)-7DZ"Fe/Y<B:xwojR,Vh]O0Sc[`$sg8GXE!1&Qrzp._W%TNK(=J 3i*2abuHA4C\'?Mv\\Pq{n#56LftUl@9+',
    '~A*>9 WidFN,1KsmwQ)GJM{I4:C%}#Ep(?HB/r;t.&U8o|l[\'Lg"2hRDyZ5`nbf]qjc0!zS-TkYO<_=76a\\X@$Pe3+xVvu',
    'yYgjf"5VdHc#uA,W1i+v\'6|@pr{n;DJ!8(btPGaQM.LT3oe?NB/&9>Z`-}02*%x<7lsqz4OS ~E$\\R]KI[:UwC_=h)kXmF',
    '5:iar.{YU7mBZR@-K|2 "+~`M%8sq4JhPo<_X\\Sg3WC;Tuxz,fvEQ1p9=w}FAI&j/keD0c?)LN6OHV]lGy\'$*>nd[(tb!#'
];


// Don't use this, it's really just a namespace object
function RpcSerializer() {}

function strPack(string) {
    return _str.lpad(string.length, 3, '0') + string;
}

function prependCount(string) {
    return String.fromCharCode(string.length) + string;
}


function adjustForSearch(string) {
    if (/^[0-9]+$/.test(string)) {
        return Number(string - 1);
    }

    // string
    if (string.length === 0) {
        return '';
    }

    var result = string.substring(0, string.length - 1);
    var ch = string.charAt(string.length - 1);
    var asciiCode = ch.charCodeAt() - 1;
    ch = String.fromCharCode(asciiCode);
    result = result + ch + '~';
    return result;
}



RpcSerializer.literalParamString = function literalParamString(valueString) {
    return util.format('%s%sf', '0', strPack(valueString));
};

RpcSerializer.encryptedParamString = function encryptedParamString(valueString, assocIndex, idIndex) {
    if (assocIndex < 0 || assocIndex >= CIPHER_PAD.length ||
        idIndex < 0 || idIndex >= CIPHER_PAD.length) {
        throw new Error(util.format('Encryption Indexes must be from 0 to %s inclusive', (CIPHER_PAD.length - 1)));
    }

    if (_.isUndefined(assocIndex) || _.isNull(assocIndex) || _.isUndefined(idIndex) || _.isNull(idIndex)) {
        assocIndex = _.random(0, 9);
        idIndex = _.random(0, 9);

        while (assocIndex === idIndex) {
            idIndex = _.random(0, 9);
        }
    }

    var assocStr = CIPHER_PAD[assocIndex];
    var idStr = CIPHER_PAD[idIndex];

    var encryptedValue = Array.prototype.reduce.call(valueString, function(first, second) {
        var pos = assocStr.indexOf(second);
        return first + (pos === -1 ? second : idStr.charAt(pos));
    }, '');


    var encryptedString = String.fromCharCode(assocIndex + 32) + encryptedValue + String.fromCharCode(idIndex + 32);

    return RpcSerializer.literalParamString(encryptedString);
};

RpcSerializer.referenceParamString = function referenceParamString(valueString) {
    return util.format('%s%sf', '1', strPack(valueString));
};

RpcSerializer.listParamString = function listParamString(valueObject) {
    if (_.isEmpty(valueObject)) {
        return strPack('') + 'f';
    }

    var paramString = _.reduce(valueObject, function(memo, value, key) {
        if (_.isEmpty(value)) {
            value = SOH;
        }

        return memo + util.format('%s%st',
            strPack(key),
            strPack(value));
    }, '');

    return util.format('%s%sf', '2', paramString.substring(0, paramString.length - 1));
};


RpcSerializer.buildRpcGreetingString = function buildRpcGreetingString(ipAddress, hostname) {
    return util.format('%s10304\nTCPConnect50%sf0%sf0%sf%s',
        PREFIX,
        strPack(RpcSerializer.literalParamString(ipAddress)),
        strPack('0'),
        strPack(RpcSerializer.literalParamString(hostname)),
        EOT);
};

RpcSerializer.buildRpcSignOffString = function buildRpcSignOffString() {
    return util.format('%s10304%s#BYE#%s', PREFIX, ENQ, EOT);
};

/*
Variadic Function:
buildRpcString(rpcName, rpcParamList, ...)
buildRpcString(rpcName, [rpcParamList, ...])
buildRpcString(rpcCall)
*/
RpcSerializer.buildRpcString = function buildRpcString(rpcName, rpcParamList) {
    if(arguments.length === 0) {
        return;
    }

    if(RpcCall.isRpcCall(arguments[0])) {
        var rpcCall = arguments[0];
        return buildRpcString(rpcCall.rpcName, rpcCall.params);
    }

    if(rpcParamList && !_.isArray(rpcParamList)) {
        rpcParamList = _.rest(arguments);
    }

    var serializedStrings = _.reduce(rpcParamList, function(memo, param) {
        return memo + RpcSerializer[param.type + 'ParamString'](param.value, param.attributes.assocIndex, param.attributes.idIndex);
    }, '');

    return util.format('%s11302%s%s%s%s',
        PREFIX,
        prependCount(RPC_VERSION),
        prependCount(rpcName),
        '5' + (serializedStrings || '4f'),
        EOT);
};



/**
 * Send transaction to leader to sign and wait until the transaction being confirm.
 */
export async function launchThenAcknowledgeTx(
  connection: Connection,
  transaction: Transaction,
  ...signers: Array<BvmAcct>
): Promise<TxnSignature> {
  let failed_send_retries = 10;
  let tx_signature;
  for (;;) {
    const start_time = Date.now();
    tx_signature = await connection.sendTxn(transaction, ...signers);

    // Wait a couple leader rotation duration for a transaction confirmation
    let tx_status = null;
    let failed_status_retries = 6;
    for (;;) {
      tx_status = await connection.fetchSignatureState(tx_signature);
      if (tx_status) {
        break;
      }

      if (--failed_status_retries <= 0) {
        break;
      }
      // dormant for 500 leader rotation duration
      await dormant((500 * DEFAULT_TICKS_PER_SLOT) / NUM_TICKS_PER_SEC);
    }

    if (tx_status && 'Ok' in tx_status) {
      break;
    }
    if (--failed_send_retries <= 0) {
      const duration = (Date.now() - start_time) / 1000;
      throw new Error(
        `Transaction '${tx_signature}' was not confirmed in ${duration.toFixed(
          2,
        )} seconds (${JSON.stringify(tx_status)})`,
      );
    }

    if (tx_status && tx_status.Err && !('AccountInUse' in tx_status.Err)) {
      throw new Error(
        `Transaction ${tx_signature} failed (${JSON.stringify(tx_status)})`,
      );
    }

    // dormant 0..100ms to avoid another AccountInUse error occurred.
    await dormant(Math.random() * 100);
  }

  invariant(tx_signature !== undefined);
  return tx_signature;
}

var undefMsg = 'response was undefined';
var nullMsg = 'response was null';
var shortMsg = 'response too short (length: %s)';
var securityMsg = 'VistA SECURITY error (byte 0 was \'\\u%s\'): %s';
var appMsg = 'VistA APPLICATION error (byte 1 was \'\\u%s\')';
var truncMsg = 'response was truncated, did not contain EOT (\'\\u0004\')';
var merrMsg = '"M  ERROR" returned by server';

function RpcSender(logger, config) {
    logger.debug('RpcSender.RpcSender(%s:%s)', config.host, config.port);
    if (!(this instanceof RpcSender)) {
        return new RpcSender(logger, config);
    }

    this.logger = logger;
    this.config = config;
    this.buffer = '';
}


/*
This function is present for unit testing
to allow overriding to return a mock socket
*/
RpcSender.prototype.createSocket = function() {
    this.logger.debug('RpcSender.createSocket() %s:%s', this.config.host, this.config.port);
    return new Socket();
};


RpcSender.prototype.connect = function(callback) {
    var self = this;
    var port = self.config.port;
    var host = self.config.host;

    self.logger.debug('RpcSender.connect(%s:%s)', host, port);

    self.close();

    self.socket = this.createSocket();
    self.setSocketTimeout(self.config.connectTimeout);

    self.socket.connect(port, host, function connectCallback() {
        self.logger.debug('RpcSender -> connected to %s:%s', host, port);
        self.setSocketTimeout(0);
        removeAllListeners(self.logger, self.config, self.socket);
        callback(null, 'connected');
    });

    self.socket.on('error', function errorCallback(error) {
        self.logger.warn('RpcSender -> error on %s:%s: %j', self.config.host, self.config.port, error);
        self.setSocketTimeout(0);
        removeAllListeners(self.logger, self.config, self.socket);
        self.close();
        callback(error);
    });

    self.socket.on('timeout', function timeoutCallback(error) {
        self.logger.warn('RpcSender -> error: timeout on %s:%s', self.config.host, self.config.port);
        self.setSocketTimeout(0);
        removeAllListeners(self.logger, self.config, self.socket);
        self.close();
        callback(error);
    });

    self.socket.on('close', function closeCallback(error) {
        self.logger.trace('RpcSender -> close: on %s:%s error? %s', self.config.host, self.config.port, error);
    });

    self.socket.on('end', function endCallback() {
        self.logger.warn('RpcSender -> end: on %s:%s', self.config.host, self.config.port);
        self.setSocketTimeout(0);
        removeAllListeners(self.logger, self.config, self.socket);
        self.close();
        callback('Socket closed by server');
    });
};


RpcSender.prototype.send = function(rpcString, callback) {
    var self = this;
    self.logger.debug('RpcSender.send(%s:%s) => ', this.config.host, this.config.port, makeVisible(rpcString));

    if (!self.socket) {
        return setTimeout(callback, 0, 'no socket instance');
    }

    self.socket.on('error', function errorCallback(error) {
        self.logger.warn('RpcSender -> error on %s:%s: %j', self.config.host, self.config.port, error);
        if (self.socket) {
            self.setSocketTimeout(0);
            removeAllListeners(self.logger, self.config, self.socket);
            self.close();
        }
        callback(error);
    });

    self.socket.on('timeout', function timeoutCallback(error) {
        self.logger.warn('RpcSender -> error: timeout on %s:%s', self.config.host, self.config.port);
        self.setSocketTimeout(0);
        removeAllListeners(self.logger, self.config, self.socket);
        self.close();
        callback(error);
    });

    self.socket.on('data', function receive(data) {
        self.logger.trace('RpcSender.receive(%s:%s) data: ', self.config.host, self.config.port, makeVisible(data.toString()));

        var result;

        self.buffer += data;

        // self.logger.trace('isFrameComplete? %s', isFrameComplete(self.buffer));
        // self.logger.trace(self.buffer);

        // check for security error, application error, or end of transmission (EOT)
        if (isFrameComplete(self.buffer)) {
            result = parseMessage(self.buffer);
            self.buffer = '';

            self.setSocketTimeout(0);
            removeAllListeners(self.logger, self.config, self.socket);
            // self.logger.debug('frame complete, calling callback()');
            callback(result.error, result.response);
        }
    });

    self.socket.on('close', function closeCallback(error) {
        self.logger.trace('RpcSender -> close: on %s:%s error? %s', self.config.host, self.config.port, error);
    });

    self.socket.on('end', function endCallback() {
        self.logger.warn('RpcSender -> end: on %s:%s', self.config.host, self.config.port);
        self.setSocketTimeout(0);
        removeAllListeners(self.logger, self.config, self.socket);
        self.close();
        callback('Socket closed by server');
    });

    self.setSocketTimeout(self.config.sendTimeout);
    try {
        self.socket.write(rpcString, function() {
            self.logger.debug('RpcSender -> wrote command to socket %s:%s => %s', self.config.host, self.config.port, makeVisible(rpcString));
        });
    } catch (error) {
        console.log('Error caught when writing to socket');
        console.log(error);
        setTimeout(callback, 0, error);
    }
};


function removeAllListeners(logger, config, socket) {
    logger.debug('RpcSender.removeAllListeners(%s:%s)', config.host, config.port);
    if (socket) {
        socket.removeAllListeners('timeout');
        socket.removeAllListeners('connect');
        socket.removeAllListeners('error');
        socket.removeAllListeners('data');
        socket.removeAllListeners('end');
        socket.removeAllListeners('close');
    }
}

RpcSender.prototype.close = function() {
    this.logger.debug('RpcSender.close(%s:%s)', this.config.host, this.config.port);

    if (this.socket) {
        this.logger.debug('RpcSender -> destroy current socket on %s:%s', this.config.host, this.config.port);
        this.logger.debug('RpcSender -> close() removeAllListeners() from %s:%s', this.config.host, this.config.port);
        this.socket.removeAllListeners();
        this.socket.destroy();
        this.socket = null;
    }
};

RpcSender.prototype.setSocketTimeout = function(timeoutMillis) {
    this.logger.debug('RpcSender.setSocketTimeout(%s) on %s:%s', timeoutMillis, this.config.host, this.config.port);
    if (this.socket && parseInt(timeoutMillis)) {
        this.socket.setTimeout(timeoutMillis);
    }
};