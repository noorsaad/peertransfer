var helpers = {}

helpers.visualReadyStatus = function () {
  var button = $('#step1 .button')
  button.css('cursor', 'pointer')
  button.click(function () {
    $('#send-input').click()
  })
  button.attr('class', 'button green send')
  setTimeout(function() {
    button.html('send a file')
    button.toggleClass('send')
    button.toggleClass('browse')
  }, 100)
}
helpers.generateRandomString = function () {
  return Math.random().toString(36).slice(-8)
}
helpers.parseAnchor = function () {
  var url = window.location.href.toString()
  var idx = url.indexOf("#")
  anchor = (idx != -1) ? url.substring(idx+1) : ""
  log('Anchor found: '+ anchor)

  if (anchor) {
    var parts = anchor.split(':')
    password = parts[2]
    authCode = parts[1]
    peerID = parts[0]
  }
}
helpers.binaryToBlob = function (data) {
  // See http://stackoverflow.com/a/10473992
  var raw_data = atob(data.split(',')[1])
  // Use typed arrays to convert the binary data to a Blob
  var arraybuffer = new ArrayBuffer(raw_data.length)
  var view = new Uint8Array(arraybuffer)
  for (var i=0; i<raw_data.length; i++) {
    view[i] = raw_data.charCodeAt(i) & 0xff
  }
  try {
    // This is the recommended method:
    var blob = new Blob([arraybuffer], {type: 'application/octet-stream'})
  } catch (e) {
    // The BlobBuilder API has been deprecated in favour of Blob, but older
    // browsers don't know about the Blob constructor
    var bb = new (window.WebKitBlobBuilder || window.MozBlobBuilder)
    bb.append(arraybuffer)
    var blob = bb.getBlob('application/octet-stream') // <-- Here's the Blob
  }
  return blob
}
helpers.step = function (i) {
  if (i == 1) back.fadeOut()
  else back.fadeIn()
  stage.css('top',(-(i-1)*100)+'%')
}
helpers.checkValidity = function (file) {
  if (!/^data:/.test(file)){
    return false
  } else return true
}
helpers.sendOnIncoming = function (conn, file, password) {
  conn.acceptConnections(function(conn, totalPeers) {
    helpers.sendFileInChunks(conn, file, password, totalPeers)
  })
}
helpers.sendFileInChunks = function (conn, file, password, totalPeers) {
  log('helpers.sendFileInChunks()')
  log(conn)
  var file_size = file.size
  log('File size: '+ file_size)
  var range_start = 0
  var range_end = chunk_size
  var chunk
  var index = 0
  var done = false
  var aborted = false
  var total = Math.ceil(file_size/chunk_size)
  var ackCounter = ackWindow
  conn.on('data', function (data) {
    if (data === 'ACK') {
      log('ACK received')
      ackCounter = ackWindow
    }
  })
  transfer.outgoing(conn, {
    index: index++,
    file_name: file.name,
    total: total
  }, password)
  var sendChunkObject = function(index, data) {
    chunk = {
      index: index,
      data: data
    }
    transfer.outgoing(conn, chunk, password)
    $('.peer-'+ conn.peer).css('background-position',
      '-'+ Math.ceil(436 - index/total * 436) +'px 0')
    loopOverChunks()
  }
  var loopOverChunks = function () {
    if (index > total) done = true
    if ( (!done && !aborted) && stopTransfer() === false) {
      log('Chunking while()')
      if (--ackCounter <= 0) {
        log('ACK response missing for too long. Aborting.')
        done = aborted = true
      }
      log('ACK counter: '+ ackCounter)
      if (encrypted_chunks[index] === undefined) {
        if (range_end > file_size) {
          done = true
          range_end = file_size
        }
        log('Sending chunk: #'+ index)
        ;(helpers.blobToDataURL)( // TODO: need IIFE right?!
          index++,
          file.slice(range_start, range_end),
          sendChunkObject)
        range_start += chunk_size
        range_end += chunk_size
        if (range_end === file_size) done = true
      } else {
        if (index > total) {
          done = true
          loopOverChunks() // to reach done animation
        } else {
          log('Using cached blob: ' + index)
          if (encrypted_chunks[index] !== undefined) {
            (helpers.blobToDataURL)( // TODO: need IIFE right?!
              index,
              encrypted_chunks[index],
              sendChunkObject)
            index++
          }
        }
      }
    } else {
      if (done) {
        if (!aborted) {
          if (totalDownloads++ === 0)
            $('.content.if-send').append('<div id=total-downloads>Total downloads: <span>0</span></div>')
          $('#total-downloads span').html(totalDownloads)
          log('Done, close()')
        } else {
          log('Aborted, close()')
        }
        //conn.close()
        var peerBar = $('.peer-'+ conn.peer)
        peerBar.fadeTo(0, 0)
        
        setTimeout(function () {
          $('.peer-'+ conn.peer).remove()
          //conn.close()
        }, 250)
        
      }
      /*
      if (stopTransfer() === true) {
        conn.close()
        ptr.disconnect()
      }
      */
    }
  }
  loopOverChunks()
}
helpers.blobToDataURL = function (index, blob, callback) {
  encrypted_chunks[index] = blob
  var reader = new FileReader()
  reader.onload = function(e) {
    log(e.target.result)
    callback(index, e.target.result)
  }
  reader.readAsDataURL(blob)
}
helpers.connectToBroker = function (reconnect) {
  helpers.parseAnchor()
  conn = new Connection(function() {
    if ( ! anchor && ! reconnect) {
      helpers.visualReadyStatus()
      password = helpers.generateRandomString() + helpers.generateRandomString()
      authCode = helpers.generateRandomString()
    }
    if (reconnect) stopTransfer = function () { return false }
  })
  conn.putOwnID('.url', authCode, password)
  return conn
}

module.exports = helpers
