<?php
use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

//include './DSNConfigurator.php';
include './Exception.php';
//include './OAuth.php';
//include './OAuthTokenProvider.php';
include './PHPMailer.php';
//include './POP3.php';
include './SMTP.php';

//require __DIR__ . '/vendor/autoload.php'; // Composer
// OR if manual:
// require 'src/Exception.php';
// require 'src/PHPMailer.php';
// require 'src/SMTP.php';
include '../config.php';
include '../authent.php';
                
$config = getConfig();
$loggedUser = getAuthenticatedUser($config);

$method = $_SERVER['REQUEST_METHOD'];

function getJsonInput() {
    $raw = file_get_contents('php://input');
    if (!$raw) return [];
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}


if($method=='POST' && $loggedUser){
    $data = getJsonInput();
    sendMail($data);
    
}

function sendMail($data){
    try {
        $recipient = $data['recipient'];
        $subject = $data['subject'];
        $content = $data['content'];
        $fileAttached = $data['file_attached'];
    // SMTP configuration
        $mail = new PHPMailer(true);

        $mail->isSMTP();
        $mail->Host       = getenv('SMTP_HOST') ?: 'smtp.ionos.com';
        $mail->SMTPAuth   = true;
        $mail->Username   = getenv('SMTP_USER') ?: '';
        $mail->Password   = getenv('SMTP_PASS') ?: '';
        $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
        $mail->Port       = (int)(getenv('SMTP_PORT') ?: 587);

        // Sender
        $mail->setFrom(
            getenv('SMTP_FROM') ?: 'noreply@example.com',
            getenv('SMTP_FROM_NAME') ?: 'BLESSP'
        );

        // Recipient
        $mail->addAddress($recipient);

        // Content
        $mail->isHTML(true);
        $mail->Subject = $subject;
        $mail->Body    = $content;
        $mail->AltBody = $content;
        
        $mail->AddAttachment($fileAttached, "invoice.pdf");
        
        $mail->send();
        
        echo '✅ Email sent successfully';
    } catch (Exception $e) {
        echo "❌ Email could not be sent. Error: {$mail->ErrorInfo}";
    }
}

