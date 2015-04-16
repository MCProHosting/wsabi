
var Jar = require('tough-cookie').CookieJar;

/**
 * Headers we look for for cookies.
 * @type {String[]}
 */
var tryCookie = ['set-cookie', 'Cookie', 'cookie'];

/**
 * The manager is responsible for handling the websocket connection and
 * ferrying data between the connection and Hapi.
 *
 * @access protected
 * @param {Hapi.Server} server
 * @param {SocketIO.Socket} socket
 * @param {Object} config
 */
function Manager(server, socket, config) {
    this.server = server;
    this.socket = socket;
    this.config = config;

    this.boot();
}

/**
 * Boots up the manager and starts listening on the connection.
 */
Manager.prototype.boot = function () {
    var $ = this;

    // Manager to use for the socket protocol.
    $.handler = detectVersion($.socket);
    // The address the cookies are on. Doesn't really matter.
    $.uri = $.server.uri || 'http://example.com';

    if ($.config.cookies) {
        // Handle cookies for the session in this nice jar.
        $.jar = new Jar();
        // Start handling.
        $.updateCookies($.socket.handshake.headers);
    }

    // When the handler tells us we have a request, inject it into the
    // server and wait for the response.
    $.handler.on('request', function (req) {
        $.syncCookies(req.headers);
        req.headers['X-Wsabi-Socket'] = $.socket;

        $.server.inject(req, function (res) {
            // Check to make sure the client didn't disconnect in the
            // middle of making a request. That would be quite rude.
            if ($.handler) {
                req.callback(res);
                $.updateCookies(res.headers);
            }
            callback = null;
        });
    });

    // When the socket disconnects, close the handler and null for gc.
    $.socket.on('disconnect', function () {
        $.handler.close();
        $.handler = null;
        $.jar = null;
    });


    $.handler.boot();
};

/**
 * Syncs the cookies with what's in the headers, if cookies are enabled.
 * It adds cookies to the chat, and copies whatever is in the jar
 * to the headers.
 * @param  {Object} headers
 */
Manager.prototype.syncCookies = function (headers) {
    if (!this.config.cookies || !headers) return;

    this.updateCookies(headers);
    headers.Cookie = this.jar.getCookieStringSync(this.uri);
};

/**
 * Updates the cookies stored on the manager.
 * @param  {Object} headers
 */
Manager.prototype.updateCookies = function (headers) {
    if (!this.config.cookies || !headers) return;

    for (var i = 0; i < tryCookie.length; i ++) {
        var h = headers[tryCookie[i]];

        if (h) {
            return this.jar.setCookieSync(h, this.uri);
        }
    }
};

/**
 * List of protocol handlers available.
 * @access private
 * @type {Object.<String, Handler>}
 */
var Handlers = {
    Sails: require('./handlers/sails')
};

/**
 * Detects the version that the socket connection should be served with.
 * It tries to read valid GET parameters. It returns a constructor
 * that should be invoked with the socket.
 *
 * @access private
 * @param  {Socket.IO} socket
 * @return {Handler}
 */
function detectVersion (socket) {
    if ('__sails_io_sdk_version' in socket.handshake.query) {
        return new Handlers.Sails(socket);
    }

    return new Handlers.Sails(socket);
}

module.exports = Manager;