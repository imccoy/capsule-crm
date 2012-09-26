/*
 * Copyright (C) 2012, Bug Buster Sàrl, Switzerland
 * Authors(s): Daniel Tralamazza, Olivier Crameri
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

var request = require('request');
var url = require('url');

var Capsule = function(account, key) {
  var self = this;

  /**
   * options = {
   *   method (GET, PUT ...)
   *   path (/party)
   *   search (foo=bar)
   *   data (object to be JSONinified)
   * }
   *
   * cb = function(err, data, response)
   */
  self.request = function(options, cb) {
    var opt = {
      url: url.format({
        protocol: 'https',
        auth: key + ':x',
        host: account + '.capsulecrm.com',
        pathname: '/api' + options.path,
        search: options.search || ''
      }),
      headers: {
        Accept: 'application/json'
      },
      method: options.method || 'GET',
      jar: false
    };
    if (options.data) {
      opt.headers['Content-Type'] = 'application/json';
      opt.body = JSON.stringify(options.data);
    }
    request(opt, function(err, res, body) {
      if (err) {
        cb(err);
      } else if (res.statusCode !== 200 && res.statusCode !== 201) {
        cb(new Error('Request returned with an invalid status code of: ' + res.statusCode));
      } else {
        cb(null, body ? JSON.parse(body) : null, res);
      }
    });
  };

  /*
   * Capsule accepts date using the ISO format but without the milliseconds.
   * This function accordingly converts a date object to a string.
   */
  self.formatDate = function(d) {
    function pad(number) {
      var r = String(number);
      if (r.length === 1)
        r = '0' + r;
      return r;
    }
    return d.getUTCFullYear() +
      '-' + pad( d.getUTCMonth() + 1 ) +
      '-' + pad( d.getUTCDate() ) +
      'T' + pad( d.getUTCHours() ) +
      ':' + pad( d.getUTCMinutes() ) +
      ':' + pad( d.getUTCSeconds() ) +
      'Z';
  };

  // create simple listing calls
  var listers = [
    'countries',
    'currencies',
    'organisation',
    'person',
    'party',
    'opportunity',
    'kase',
    'tasks',
    'users'
  ];
  listers.forEach(function(li) {
    self[li] = function(cb) {
      self.request({ path: '/' + li }, cb);
    };
  });


  var capitalize = function(string) {
    return string && string.charAt(0).toUpperCase() + string.slice(1, string.length);
  };

  /*
   * Utility to process the result of a query in the location header,
   * or return an error
   */
  var resultInLocationHeader = function(cb) {
    return function(error, body, res) {
      if (error) {
        cb(error);
      } else if (res.headers && res.headers.location) {
        cb(null, res.headers.location.split('/').pop(), res);
      } else {
        cb(new Error('Missing location header'), body, res);
      }
    };
  };

  /*
   * Helpers for APIs to create new entries
   */
  var adders = [
    'person',
    'organisation',
    'task'
  ];
  adders.forEach(function(ad) {
    self['add' + capitalize(ad)] = function(data, cb) {
      self.request({
        path: '/' + ad,
        method: 'POST',
        data: data
      }, resultInLocationHeader(cb));
    };
  });

  /*
   * Helpers for APIs to create entries related
   * to other entries
   * E.g.: opportunity for a party
   */
  var addersFor = [
    'opportunity',
    'task'
  ];
  addersFor.forEach(function(af) {
    self['add' + capitalize(af) + 'For'] = function(forType, forId, data, cb) {
      self.request({
        path: '/' + forType + '/' + forId + '/' + af,
        method: 'POST',
        data: data
      }, resultInLocationHeader(cb));
    };
  });

  var taggers = [
    // TODO investigate which primitives have tags
    'opportunity',
    'user'
  ];
  taggers.forEach(function(tf) {
    self[tf + 'Tags'] = function(id, cb) {
      self.request({
        path: '/' + tf + '/' + id + '/tag',
        method: 'GET'
      }, cb);
    };
  });

  self.addTagFor = function(forType, forId, tagName, cb) {
    self.request({
      path: '/' + forType + '/' + forId + '/tag/' + tagName,
      method: 'POST'
    }, resultInLocationHeader(cb));
  };

  /*
   * Set a custom field for an object type.
   * XXX the custom field must already exist in Capsule,
   * it is not automatically created.
   */
  self.setCustomFieldFor = function(forType, forId, data, cb) {
    self.request({
      path: '/' + forType + '/' + forId + '/customfields',
      method: 'PUT',
      data: data
    }, cb);
  };

  var customFielders = [
    // TODO investigate which primitives have custom fields
    'opportunity',
    'user'
  ];
  customFielders.forEach(function(cf) {
    self[cf + 'CustomFields'] = function(id, cb) {
      self.request({
        path: '/' + cf + '/' + id + '/customfields',
        method: 'GET'
      }, cb);
    };
  });

  /*
   * Helpers for APIs to delete entries
   */
  var deleters = [
    'party',
    'opportunity',
    'kase',
    'history',
    'task'
  ];
  deleters.forEach(function(li) {
    self['delete' + capitalize(li)] = function(objectId, cb) {
      self.request({
        path: '/' + li + '/' + objectId,
        method: 'DELETE'
      }, cb);
    };
  });
};

exports.createConnection = function(account, key) {
  return new Capsule(account, key);
};
