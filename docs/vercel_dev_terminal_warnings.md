Failed to compile.

SyntaxError: C:\Users\Tristan Ryan\lightship-app\lightship-fund-analysis\src\components\Reports\PDFPreview.jsx: Unexpected token, expected "," (179:16)
  177 |         </PDFViewer>
  178 |       ) : (
> 179 |         !Loading... <div>No data to render.</div>
      |                 ^
  180 |       )}
  181 |
  182 |       {/* Save as default (export theme.js) */}
WARNING in [eslint] 
src\components\Admin\AdminOverview.jsx
  Line 1:1:  Unexpected Unicode BOM (Byte Order Mark)  unicode-bom

src\components\Admin\ScoringWeights.jsx
  Line 103:3:  The 'buildOverlayResolver' function makes the dependencies of useMemo Hook (at line 162) change on every render. To fix this, wrap the definition of 'buildOverlayResolver' in its own useCallback() Hook  react-hooks/exhaustive-deps

ERROR in ./src/components/Reports/PDFPreview.jsx
Module build failed (from ./node_modules/babel-loader/lib/index.js):
SyntaxError: C:\Users\Tristan Ryan\lightship-app\lightship-fund-analysis\src\components\Reports\PDFPreview.jsx: Unexpected token, expected "," (179:16)

  177 |         </PDFViewer>
  178 |       ) : (
> 179 |         !Loading... <div>No data to render.</div>
      |                 ^
  180 |       )}
  181 |
  182 |       {/* Save as default (export theme.js) */}
    at constructor (C:\Users\Tristan Ryan\lightship-app\lightship-fund-analysis\node_modules\@babel\parser\lib\index.js:363:19)
    at FlowParserMixin.raise (C:\Users\Tristan Ryan\lightship-app\lightship-fund-analysis\node_modules\@babel\parser\lib\index.js:6612:19)
    at FlowParserMixin.unexpected (C:\Users\Tristan Ryan\lightship-app\lightship-fund-analysis\node_modules\@babel\parser\lib\index.js:6632:16)
    at FlowParserMixin.expect (C:\Users\Tristan Ryan\lightship-app\lightship-fund-analysis\node_modules\@babel\parser\lib\index.js:6912:12)
    at FlowParserMixin.parseParenAndDistinguishExpression (C:\Users\Tristan Ryan\lightship-app\lightship-fund-analysis\node_modules\@babel\parser\lib\index.js:11608:14)
    at FlowParserMixin.parseParenAndDistinguishExpression (C:\Users\Tristan Ryan\lightship-app\lightship-fund-analysis\node_modules\@babel\parser\lib\index.js:3606:18)
    at FlowParserMixin.parseExprAtom (C:\Users\Tristan Ryan\lightship-app\lightship-fund-analysis\node_modules\@babel\parser\lib\index.js:11276:23)
    at FlowParserMixin.parseExprAtom (C:\Users\Tristan Ryan\lightship-app\lightship-fund-analysis\node_modules\@babel\parser\lib\index.js:4779:20)
    at FlowParserMixin.parseExprSubscripts (C:\Users\Tristan Ryan\lightship-app\lightship-fund-analysis\node_modules\@babel\parser\lib\index.js:11026:23)
    at FlowParserMixin.parseUpdate (C:\Users\Tristan Ryan\lightship-app\lightship-fund-analysis\node_modules\@babel\parser\lib\index.js:11011:21)
    at FlowParserMixin.parseMaybeUnary (C:\Users\Tristan Ryan\lightship-app\lightship-fund-analysis\node_modules\@babel\parser\lib\index.js:10991:23)
    at FlowParserMixin.parseMaybeUnaryOrPrivate (C:\Users\Tristan Ryan\lightship-app\lightship-fund-analysis\node_modules\@babel\parser\lib\index.js:10844:61)
    at FlowParserMixin.parseExprOps (C:\Users\Tristan Ryan\lightship-app\lightship-fund-analysis\node_modules\@babel\parser\lib\index.js:10849:23)
    at FlowParserMixin.parseMaybeConditional (C:\Users\Tristan Ryan\lightship-app\lightship-fund-analysis\node_modules\@babel\parser\lib\index.js:10826:23)
    at FlowParserMixin.parseMaybeAssign (C:\Users\Tristan Ryan\lightship-app\lightship-fund-analysis\node_modules\@babel\parser\lib\index.js:10779:21)
    at FlowParserMixin.parseMaybeAssign (C:\Users\Tristan Ryan\lightship-app\lightship-fund-analysis\node_modules\@babel\parser\lib\index.js:3564:18)
    at C:\Users\Tristan Ryan\lightship-app\lightship-fund-analysis\node_modules\@babel\parser\lib\index.js:3031:77
    at FlowParserMixin.forwardNoArrowParamsConversionAt (C:\Users\Tristan Ryan\lightship-app\lightship-fund-analysis\node_modules\@babel\parser\lib\index.js:3081:16)
    at FlowParserMixin.parseConditional (C:\Users\Tristan Ryan\lightship-app\lightship-fund-analysis\node_modules\@babel\parser\lib\index.js:3031:27)
    at FlowParserMixin.parseMaybeConditional (C:\Users\Tristan Ryan\lightship-app\lightship-fund-analysis\node_modules\@babel\parser\lib\index.js:10830:17)
    at FlowParserMixin.parseMaybeAssign (C:\Users\Tristan Ryan\lightship-app\lightship-fund-analysis\node_modules\@babel\parser\lib\index.js:10779:21)
    at FlowParserMixin.parseMaybeAssign (C:\Users\Tristan Ryan\lightship-app\lightship-fund-analysis\node_modules\@babel\parser\lib\index.js:3564:18)
    at FlowParserMixin.parseExpressionBase (C:\Users\Tristan Ryan\lightship-app\lightship-fund-analysis\node_modules\@babel\parser\lib\index.js:10732:23)
    at C:\Users\Tristan Ryan\lightship-app\lightship-fund-analysis\node_modules\@babel\parser\lib\index.js:10728:39
    at FlowParserMixin.allowInAnd (C:\Users\Tristan Ryan\lightship-app\lightship-fund-analysis\node_modules\@babel\parser\lib\index.js:12375:12)
    at FlowParserMixin.parseExpression (C:\Users\Tristan Ryan\lightship-app\lightship-fund-analysis\node_modules\@babel\parser\lib\index.js:10728:17)
    at FlowParserMixin.jsxParseExpressionContainer (C:\Users\Tristan Ryan\lightship-app\lightship-fund-analysis\node_modules\@babel\parser\lib\index.js:4647:31)
    at FlowParserMixin.jsxParseElementAt (C:\Users\Tristan Ryan\lightship-app\lightship-fund-analysis\node_modules\@babel\parser\lib\index.js:4726:36)
    at FlowParserMixin.jsxParseElement (C:\Users\Tristan Ryan\lightship-app\lightship-fund-analysis\node_modules\@babel\parser\lib\index.js:4764:17)
    at FlowParserMixin.parseExprAtom (C:\Users\Tristan Ryan\lightship-app\lightship-fund-analysis\node_modules\@babel\parser\lib\index.js:4774:19)
    at FlowParserMixin.parseExprSubscripts (C:\Users\Tristan Ryan\lightship-app\lightship-fund-analysis\node_modules\@babel\parser\lib\index.js:11026:23)
    at FlowParserMixin.parseUpdate (C:\Users\Tristan Ryan\lightship-app\lightship-fund-analysis\node_modules\@babel\parser\lib\index.js:11011:21)
    at FlowParserMixin.parseMaybeUnary (C:\Users\Tristan Ryan\lightship-app\lightship-fund-analysis\node_modules\@babel\parser\lib\index.js:10991:23)
    at FlowParserMixin.parseMaybeUnaryOrPrivate (C:\Users\Tristan Ryan\lightship-app\lightship-fund-analysis\node_modules\@babel\parser\lib\index.js:10844:61)
    at FlowParserMixin.parseExprOps (C:\Users\Tristan Ryan\lightship-app\lightship-fund-analysis\node_modules\@babel\parser\lib\index.js:10849:23)
    at FlowParserMixin.parseMaybeConditional (C:\Users\Tristan Ryan\lightship-app\lightship-fund-analysis\node_modules\@babel\parser\lib\index.js:10826:23)
    at FlowParserMixin.parseMaybeAssign (C:\Users\Tristan Ryan\lightship-app\lightship-fund-analysis\node_modules\@babel\parser\lib\index.js:10779:21)
    at C:\Users\Tristan Ryan\lightship-app\lightship-fund-analysis\node_modules\@babel\parser\lib\index.js:3513:39
    at FlowParserMixin.tryParse (C:\Users\Tristan Ryan\lightship-app\lightship-fund-analysis\node_modules\@babel\parser\lib\index.js:6920:20)
    at FlowParserMixin.parseMaybeAssign (C:\Users\Tristan Ryan\lightship-app\lightship-fund-analysis\node_modules\@babel\parser\lib\index.js:3513:18)
    at C:\Users\Tristan Ryan\lightship-app\lightship-fund-analysis\node_modules\@babel\parser\lib\index.js:10748:39
    at FlowParserMixin.allowInAnd (C:\Users\Tristan Ryan\lightship-app\lightship-fund-analysis\node_modules\@babel\parser\lib\index.js:12375:12)
    at FlowParserMixin.parseMaybeAssignAllowIn (C:\Users\Tristan Ryan\lightship-app\lightship-fund-analysis\node_modules\@babel\parser\lib\index.js:10748:17)
    at FlowParserMixin.parseParenAndDistinguishExpression (C:\Users\Tristan Ryan\lightship-app\lightship-fund-analysis\node_modules\@babel\parser\lib\index.js:11622:28)
    at FlowParserMixin.parseParenAndDistinguishExpression (C:\Users\Tristan Ryan\lightship-app\lightship-fund-analysis\node_modules\@babel\parser\lib\index.js:3606:18)
    at FlowParserMixin.parseExprAtom (C:\Users\Tristan Ryan\lightship-app\lightship-fund-analysis\node_modules\@babel\parser\lib\index.js:11276:23)
    at FlowParserMixin.parseExprAtom (C:\Users\Tristan Ryan\lightship-app\lightship-fund-analysis\node_modules\@babel\parser\lib\index.js:4779:20)
    at FlowParserMixin.parseExprSubscripts (C:\Users\Tristan Ryan\lightship-app\lightship-fund-analysis\node_modules\@babel\parser\lib\index.js:11026:23)
    at FlowParserMixin.parseUpdate (C:\Users\Tristan Ryan\lightship-app\lightship-fund-analysis\node_modules\@babel\parser\lib\index.js:11011:21)
    at FlowParserMixin.parseMaybeUnary (C:\Users\Tristan Ryan\lightship-app\lightship-fund-analysis\node_modules\@babel\parser\lib\index.js:10991:23)

ERROR in [eslint]
src\components\Reports\PDFPreview.jsx
  Line 179:16:  Parsing error: Unexpected token, expected "," (179:16)

webpack compiled with 2 errors and 1 warning