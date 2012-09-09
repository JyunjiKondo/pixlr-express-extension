var createUrl = function(imageUrl) {
  return 'http://pixlr.com/express?image='
    + imageUrl
    + '&target=http://pixlr-express-extension/result'
    + '&exit=http://pixlr-express-extension/cancel';
}

var convertToDataUri = function(uri, success, error) {
  var xhr = new XMLHttpRequest();
  xhr.open('GET', uri, true);
  xhr.responseType = 'blob';
  xhr.onload = function(e) {
    if (this.status == 200) {
      var reader = new FileReader();
      reader.onload = function() {
        success(reader.result);
      };
      reader.readAsDataURL(this.response);
    } else {
      error();
    }
  };
  xhr.send();
}

var launchEditor = function(imageUrl, type) {
  // expressを開くURLを生成する。
  url = createUrl(imageUrl);

  // target URLへのredirectを検知するlistenerを登録する。
  chrome.webRequest.onBeforeRequest.addListener(
    function(details) {
      // details.url から画像のURLを取り出してintent発行元に返す。
      url = URI(details.url).query(true).image;
      if (type == 'link uri') {
        window.webkitIntent.postResult(url);
      } else { // data uri
        convertToDataUri(
          url,
          function(data) {
            window.webkitIntent.postResult(data);
          },
          function() {
            window.webkitIntent.postFailure('data download error');
          });
      }
      return {cancel: true}; // redirectをキャンセルする。
    },
    {urls: ["http://pixlr-express-extension/result*"]},
    ["blocking"]
  );
  // exit URLへのredirectを検知するlistenerを登録する。
  chrome.webRequest.onBeforeRequest.addListener(
    function(details) {
      // 編集がcancelされたので、intent発行元にその旨を返す。
      window.webkitIntent.postFailure('editing canceled');
      return {cancel: true}; // redirectをキャンセルする。
    },
    {urls: ["http://pixlr-express-extension/cancel*"]},
    ["blocking"]
  );

  // expressを開く。
  $('#root > iframe').attr('src', url);
}

var uploadImage = function(dataUrl, type) {
  $.post('http://imm.io/store/',
    { 'image': dataUrl, 'name': 'img-' + Date.now() },
    function (data) {
      var obj = JSON.parse(data);
      launchEditor(obj.payload.uri, type);
    }
  );
}

var loadFromIntent = function() {
  var data = window.webkitIntent.data;
  if (typeof(data) == 'string') {
    if (data.match(/^data:/)) {
      // data-URL
      // 画像をimm.ioに登録してURLを得る。
      uploadImage(data, 'data uri');
    } else if (data.match(/^http/)) {
      // imageへのlink
      launchEditor(data, 'link uri');
    } else {
      // 未サポートのデータ
      window.webkitIntent.postFailure('unsupported data');
    }
  } else {
    // 未サポートのデータ
    window.webkitIntent.postFailure('unsupported data');
  }
};

var EditServiceLoaded = function() {
  if (window.webkitIntent) {
    loadFromIntent();
  }
};

window.addEventListener("load", EditServiceLoaded);
