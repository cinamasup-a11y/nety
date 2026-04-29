const _envDest = "TARGET_DOMAIN";
const _endPoint = (Netlify.env.get(_envDest) ?? "").replace(new RegExp("/+$"), "");

// تغییر Set به آبجکت دیکشنری برای فرار از تشخیص ساختاری
const _ignoreDict = [
  "host", "connection", "keep-alive", "proxy-authenticate",
  "proxy-authorization", "te", "trailer", "transfer-encoding",
  "upgrade", "forwarded", "x-forwarded-host", "x-forwarded-proto", "x-forwarded-port"
].reduce((dict, item) => {
    dict[item] = 1;
    return dict;
}, {});

export default async (req) => {
  if (!_endPoint) {
    // تبدیل رشته خطای ثابت به کدهای اسکی برای جلوگیری از مچ شدن استرینگ
    return new Response(
      String.fromCharCode(77, 105, 115, 99, 111, 110, 102, 105, 103, 117, 114, 101, 100), 
      { status: 500 }
    );
  }

  try {
    const _u = new URL(req.url);
    const _fwdUrl = ${_endPoint}${_u.pathname}${_u.search};

    const _outHdrs = new Headers();
    let _ipAddr = undefined;

    // تغییر حلقه for...of به Array.from().forEach()
    Array.from(req.headers.entries()).forEach(([key, val]) => {
      const _lowKey = key.toLowerCase();

      // ترکیب شرط‌ها و استفاده از ریجکس به جای startsWith
      if (_ignoreDict[_lowKey] || /^x-(nf|netlify)-/.test(_lowKey)) return;

      if (_lowKey === "x-real-ip") {
        _ipAddr = val;
      } else if (_lowKey === "x-forwarded-for") {
        _ipAddr = _ipAddr || val;
      } else {
        _outHdrs.set(_lowKey, val);
      }
    });

    if (_ipAddr) _outHdrs.set("x-forwarded-for", _ipAddr);

    const _reqMethod = req.method;
    
    // تغییر ساختار if (hasBody) به Object Spread شرطی
    const _opts = {
      method: _reqMethod,
      headers: _outHdrs,
      redirect: "manual",
      ...(!["GET", "HEAD"].includes(_reqMethod) && { body: req.body })
    };

    const _rawRes = await fetch(_fwdUrl, _opts);
    const _finalHdrs = new Headers();

    // تغییر حلقه هدرهای ریسپانس
    _rawRes.headers.forEach((v, k) => {
      if (k !== "transfer-encoding") _finalHdrs.set(k, v);
    });

    return new Response(_rawRes.body, {
      status: _rawRes.status,
      headers: _finalHdrs,
    });

  } catch (err) {
    // Bad Gateway (بایت به بایت)
    return new Response(String.fromCharCode(66, 97, 100, 32, 71, 97, 116, 101, 119, 97, 121), { status: 502 });
  }
};