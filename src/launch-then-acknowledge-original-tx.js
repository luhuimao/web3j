// @flow

import {Connection} from './netutility';
import {dormant} from './dormant';
import type {TxnSignature} from './tx-dapp';
import {DEFAULT_TICKS_PER_SLOT, NUM_TICKS_PER_SEC} from './timing';


const fs = require('fs');
var debug = true;

function setDebug(value) { debug = value; }
function getDebug() { return debug; }
function cLog(value) { if (debug) console.log(value); }
function testLog(value) { console.log(value); }
function mkdir(path) {
  try {
    fs.mkdirSync(path);
  } catch(e) {
    if ( e.code != 'EEXIST' ) throw e;
  }
 }

function rmdir(path) {
  if( fs.existsSync(path) ) {
    fs.readdirSync(path).forEach(function(file,index){
      var curPath = path + "/" + file;
      if(fs.lstatSync(curPath).isDirectory()) { // recurse
        rmdir(curPath);
      } else { // delete file
        fs.unlinkSync(curPath);
      }
    });
    fs.rmdirSync(path);
  }
 }

function fileExists(path)
 {
    if(fs.existsSync(path))
	return true;
    return false;
 }

function readFile(path, callback, cb) {
    fs.readFile(path, 'utf8',  (err, data) => { callback (err, data, cb) });
 }

function writeFile(path, data) {
   fs.writeFile(path, data, (err) => { if (err) throw err;});
 }

function listFiles(dir, recursive = false) {

    var results = [];
    fs.readdirSync(dir).forEach(function(file) {
        file = dir+'/'+file;
        var stat = fs.statSync(file);

        if (stat && stat.isDirectory() && recursive) {
            results = results.concat(listFiles(file, recursive))
        } else results.push(file);
    });

    return results;
 }

function listFolders(dir) {

    var results = [];
    fs.readdirSync(dir).forEach(function(file) {
        file = dir+'/'+file;
        var stat = fs.statSync(file);

        if (stat && stat.isDirectory()) {
            results.push(file);
        }
    });

    return results;
 }




/**
 * send transaction to the network
 * get transaction's status by signature
 */
export async function launchThenAcknowledgeNativeTxn(
  connection: Connection,
  originalTransaction: Buffer,
): Promise<TxnSignature> {
  const start_time = Date.now();
  let tx_signature = await connection.sendNativeTxn(originalTransaction);

  // Wait up to a couple slots for a confirmation
  let tx_status = null;
  let failed_status_retries = 6;
  for (;;) {
    tx_status = await connection.fetchSignatureState(tx_signature);
    if (tx_status) {
      break;
    }

    // dormant for 500 leader rotation duration
    await dormant((500 * DEFAULT_TICKS_PER_SLOT) / NUM_TICKS_PER_SEC);

    if (--failed_status_retries <= 0) {
      const duration = (Date.now() - start_time) / 1000;
      throw new Error(
        `Raw Transaction '${tx_signature}' was not confirmed in ${duration.toFixed(
          2,
        )} seconds (${JSON.stringify(tx_status)})`,
      );
    }
  }

  if (tx_status && 'Ok' in tx_status) {
    return tx_signature;
  }

  throw new Error(
    `Raw transaction ${tx_signature} failed (${JSON.stringify(tx_status)})`,
  );
}


var lastResponse;
var nodes = {};


function startNode (nodeExec, dataDir, genesisPath, listeningPort, finished) 
{
  var utils = require('./utils.js');
  var spawn = require('child_process').spawn
  var options = [
    '--private', 'privatechain',
    '-d', dataDir,
    '--config', genesisPath,
    '--ipcpath', dataDir + '/geth.ipc',
    '--ipc',
    '--listen', listeningPort,
    '--test',
    '-a', '0x1122334455667788991011121314151617181920'
  ]
  utils.cLog('starting node')
  utils.cLog(nodeExec + ' ' + options.join(' '))
  var node = spawn(nodeExec, options)
  node.stdout.on('data', (data) => {
    utils.cLog(`stdout: ${data}`)
  })
  node.stderr.on('data', (data) => {
    utils.cLog(`stderr: ${data}`)
  })
  node.on('close', (code) => {
    utils.cLog(`child process exited with code ${code}`)
  })

  nodes[dataDir] = node;
  utils.sleep(14000).then(() => {
	utils.cLog("Node Started");
	finished();
  });
}

function stopNode(dataDir, finished)
{
  nodes[dataDir].kill();
  var utils = require('./utils.js');
  utils.sleep(1000).then(() => {
	finished();
  });
}


function runScriptOnNode(dataDir, jsScript, args, finished)
{
	var utils = require('./utils.js');
	var ipcPath = dataDir + '/geth.ipc';

	var Web3 = require('web3');
	var web3admin = require('./web3Admin.js');
	var net = require('net');

	utils.cLog("Connecting to node at " + ipcPath);
	var web3 = new Web3(new Web3.providers.IpcProvider(ipcPath, net));
	web3admin.extend(web3);
	global.web3 = web3;

	var onScriptCallback = function (err, data)
	{
		utils.cLog(data);
		lastResponse = data;
		finished();
	}
	global.callback = onScriptCallback;
	global.args = args;

	var vm = require('vm');
	utils.cLog("Executing " + jsScript + " ...");
	fs.readFile(jsScript, 'utf8', function (err, data)
	{
		if (err)
		{
			utils.cLog(err);
			finished();
		}
		else
		{
			var script = new vm.Script(data);
			script.runInThisContext();
		}
	});
}


function getLastResponse() 
{
	return lastResponse;
}
