const { withRNVNext } = require('@rnv/adapter');

const config = {
    compress: false,
    // Self-contained server output so the TV web app can be copied to the VPS and run with plain node (tv.connekyt.com).
    output: 'standalone',
};

module.exports = withRNVNext(config);
