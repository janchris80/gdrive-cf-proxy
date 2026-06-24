<?php
/**
 * Laravel ImageHelper for the GDrive CF Proxy.
 *
 * 1. Save this file as app/Helpers/ImageHelper.php
 * 2. Update WORKER_URL to your deployed Worker URL.
 * 3. (Optional) autoload it in composer.json:
 *
 *    "autoload": {
 *        "files": ["app/Helpers/ImageHelper.php"]
 *    }
 *
 * Usage in Blade:
 *    <img src="{{ \App\Helpers\ImageHelper::fbPost($pubmat->gdrive_id) }}">
 */

namespace App\Helpers;

class ImageHelper
{
    /** Your deployed Worker URL. No trailing slash. */
    const WORKER_URL = 'https://gdrive-cf-proxy.YOUR-SUBDOMAIN.workers.dev';

    public static function url(string $fileId, string $size = 'w1600'): string
    {
        return self::WORKER_URL . '/' . $fileId . '/' . $size;
    }

    /** Original full-size image (use for downloads). */
    public static function original(string $fileId): string
    {
        return self::url($fileId, 's0');
    }

    /** Facebook post size (1200px wide). */
    public static function fbPost(string $fileId): string
    {
        return self::url($fileId, 'w1200');
    }

    /** Website hero (1920px wide). */
    public static function hero(string $fileId): string
    {
        return self::url($fileId, 'w1920');
    }

    /** Card / grid image (800px wide). */
    public static function card(string $fileId): string
    {
        return self::url($fileId, 'w800');
    }

    /** List thumbnail (400px wide). */
    public static function thumb(string $fileId): string
    {
        return self::url($fileId, 'w400');
    }
}
