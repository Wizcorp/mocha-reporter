mocha-reporter
==============

Mocha reporter, enhanced.

Features
--------

### Log captures

![Log capture screenshot](./screenshots/log-capture.png)

Capture stdout and stderr, and pretty-prints it only on error or when the DEBUG environment variable
is set (like in the example above). This allows you to still leverage logging within your tests,
or even add test-specific logs.

### Pretty errors

![Pretty errors](./screenshots/pretty-errors.png)

Thrown or returned errors will look much prettier now.


![espower-loader](./screenshots/espower-loader-pretty-errors.png)

It looks even better when combined with
[espower-loader](https://github.com/power-assert-js/espower-loader)!

Installation
------------

```shell
npm install --save mocha-reporter
```

Usage
-----

Under `package.json`:

```json
{
  "scripts": {
    "test:unit": "mocha --reporter mocha-reporter"
  }
}
```

License
-------

MIT

