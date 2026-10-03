import webpush from "web-push";

// cetak pasangan kunci VAPID untuk .env; kunci privat hanya ditampilkan di terminal ini
const keys = webpush.generateVAPIDKeys();
console.log(`VAPID_PUBLIC_KEY=${keys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}`);
console.log("VAPID_SUBJECT=mailto:kamu@contoh.id");
