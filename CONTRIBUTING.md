# How to Contribute

We'd love to accept your patches and contributions to this project. There are
just a few small guidelines you need to follow.

## Contributor License Agreement

Contributions to this project must be accompanied by a Contributor License
Agreement. You (or your employer) retain the copyright to your contribution;
this simply gives us permission to use and redistribute your contributions as
part of the project. Head over to <https://cla.developers.google.com/> to see
your current agreements on file or to sign a new one.

You generally only need to submit a CLA once, so if you've already submitted one
(even if it was for a different project), you probably don't need to do it
again.

## Code reviews

All submissions, including submissions by project members, require review. We
use GitHub pull requests for this purpose. Consult
[GitHub Help](https://help.github.com/articles/about-pull-requests/) for more
information on using pull requests.

## Testing

To test the full suite run `npm run test`.

To test a subset of browsers or metrics, run the following in separate terminals:

- `npm run watch`
- `npm run test:server`
- `npm run test:e2e -- --browsesr=chrome --metrics=TTFB`

The last command can be replaced as you see fit and include comma, separated values. For example:

- `npm run test:e2e -- --browsesr=chrome,firefox --metrics=TTFB,LCP`

To run an individual test, change `it('test name')` to `it.only('test name')`.

You can also add `await browser.debug()` lines to the individual test files to pause execution, and press `CTRL+C` in the command line to continue the tests.

See the https://webdriver.io/ for more information.

## Community Guidelines

This project follows [Google's Open Source Community
Guidelines](https://opensource.google/conduct/).
