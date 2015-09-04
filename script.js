'use strict';

var scaleConnectionId = null;
var lastReading = null;

var scaleServerBaseUrl = 'http://chaden-dev-upgrade.spoonflower.com/admin/shippings';

initScale();
watchTokenChanges();

function initScale() {
  var filters = [
    {usage: 1, usagePage: 141},
    {usage: 32, usagePage: 141}
  ];

  chrome.hid.getDevices({filters: filters}, function(devices) {
    if (devices.length === 0) {
      document.getElementById('status').innerHTML = 'No scale found';
    }
    else {
      // just go with the first scale listed
      chrome.hid.connect(devices[0].deviceId, function(connection) {
        document.getElementById('status').innerHTML = 'Connected to scale';
        scaleConnectionId = connection.connectionId;
        pollScale();
      });
    }
  })
}

function formatRaw(bytes) {
  var ar = [];
  for (var i = 0; i < bytes.length; i++) {
    ar[i] = bytes[i];
  }

  return ar.join(' ');
}

function pollScale() {
  chrome.hid.receive(scaleConnectionId, function(reportId, data) {
    if (reportId === 3) {
      // we have a measurement from the scale
      var bytes = new Uint8Array(data);

      if (document.getElementById('raw')) {
        document.getElementById('raw').innerHTML = formatRaw(bytes);
      }

      // check to make sure the scale is stable
      if (bytes[0] === 2 || bytes[0] === 4) {
        var unit;

        if (bytes[1] === 11) {
          unit = 'oz';
        }
        else if (bytes[1] === 12) {
          unit = 'lb';
        }
        else if (bytes[1] === 3) {
          unit = 'kg';
        }
        else {
          unit = '--';
        }

        // the scaling factor is a signed integer
        var factor = new Int8Array(data)[2];
        var fixedDigits = 0 - factor;
        if (fixedDigits < 0) fixedDigits = 0;

        var newReading = ((bytes[4] * 256 + bytes[3]) * Math.pow(10, factor)).toFixed(fixedDigits) + ' ' + unit;

        if (newReading !== lastReading) {
          lastReading = newReading;
          reportReading();
        }
      }
    }
    setTimeout(pollScale, 0);
  });
}

function reportReading() {
  document.getElementById('reading').innerHTML = lastReading;

  var scaleToken = document.getElementById('scaleToken').value;

  if (scaleToken) {
    var req = new XMLHttpRequest();
    // req.open('POST', scaleServerBaseUrl + '/report/' + scaleToken, true);
    req.open('POST', scaleServerBaseUrl, true);
    req.setRequestHeader("Content-type","application/x-www-form-urlencoded");
    req.send('reading=' + lastReading);
  }
}

function watchTokenChanges() {
  var timeout = null;
  var inputElt = document.getElementById('scaleToken');

  chrome.storage.local.get('scaleToken', function(result) {
    inputElt.value = result.scaleToken || '';
  });

  inputElt.oninput = function() {
    if (timeout) {
      clearTimeout(timeout);
    }

    timeout = setTimeout(saveToken, 250);
  };

  function saveToken() {
    chrome.storage.local.set({scaleToken: inputElt.value});
  }
}
