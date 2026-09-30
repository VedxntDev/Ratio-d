# pip install "qrcode[pil]" ; python3 tools/make-test-qrs.py  -> assets/qr-samples/*.png
import qrcode, os
S = {
 "good-github": "https://github.com/VedxntDev/Ratio-d",
 "good-upi": "upi://pay?pa=shop@okhdfcbank&pn=Sharma%20Stores&cu=INR",
 "bad-paypal": "http://paypa1-verify-account.xyz/login?email=victim@example.com",
 "bad-ip": "http://198.51.100.7/secure/update",
 "bad-ms": "https://microsoft-support.top/office365/signin",
 "bad-short": "https://bit.ly/3xAbCd",
 "bad-upi-refund": "upi://pay?pa=scam@ybl&pn=Refund%20Desk&am=4999&cu=INR&tn=refund",
}
out = os.path.join(os.path.dirname(__file__), "..", "assets", "qr-samples"); os.makedirs(out, exist_ok=True)
for name, data in S.items():
    qrcode.make(data, box_size=8, border=4).save(os.path.join(out, name + ".png"))
print("wrote", len(S), "samples")
