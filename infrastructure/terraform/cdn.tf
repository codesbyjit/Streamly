# AWS CloudFront Distribution for Video
resource "aws_cloudfront_distribution" "video_cdn" {
  enabled             = true
  is_ipv6_enabled     = true
  comment             = "StreamFlow Video CDN"
  default_root_object = "index.html"

  origin {
    domain_name = aws_s3_bucket.processed.bucket_regional_domain_name
    origin_id   = "S3-processed-videos"

    s3_origin_config {
      origin_access_identity = aws_cloudfront_origin_access_identity.video_oai.cloudfront_access_identity_path
    }
  }

  origin {
    domain_name = aws_s3_bucket.thumbnails.bucket_regional_domain_name
    origin_id   = "S3-thumbnails"

    s3_origin_config {
      origin_access_identity = aws_cloudfront_origin_access_identity.video_oai.cloudfront_access_identity_path
    }
  }

  default_cache_behavior {
    allowed_methods  = ["GET", "HEAD", "OPTIONS"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "S3-processed-videos"

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 86400
    default_ttl            = 604800
    max_ttl                = 31536000
    compress               = true
  }

  ordered_cache_behavior {
    path_pattern     = "*.mpd"
    allowed_methods  = ["GET", "HEAD"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "S3-processed-videos"

    forwarded_values {
      query_string = false
    }

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 60
    max_ttl                = 300
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }

  price_class = "PriceClass_200"
}