from django.db import models

class Coupon(models.Model):
    code = models.CharField(max_length=20, unique=True)
    discount_percentage = models.PositiveIntegerField(help_text="Discount in percentage (e.g., 10 for 10%)")
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.code} ({self.discount_percentage}%)"

class Advertisement(models.Model):
    title = models.CharField(max_length=255)
    image = models.ImageField(upload_to='ads/', blank=True, null=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.title

class AdminPanelCredential(models.Model):
    """
    Singleton holding the admin panel's 3-step login (password → PIN → security answer).
    Only hashes are stored. Edited from the admin panel's Settings page.
    """
    password_hash = models.CharField(max_length=256)
    pin_hash = models.CharField(max_length=256)
    question = models.CharField(max_length=255, default='Who are you?')
    answer_hash = models.CharField(max_length=256)
    updated_at = models.DateTimeField(auto_now=True)

    @classmethod
    def get(cls):
        from .default_secrets import DEFAULT_PASSWORD_HASH, DEFAULT_PIN_HASH, DEFAULT_ANSWER_HASH, DEFAULT_QUESTION
        obj = cls.objects.first()
        if obj is None:
            obj = cls.objects.create(
                password_hash=DEFAULT_PASSWORD_HASH,
                pin_hash=DEFAULT_PIN_HASH,
                answer_hash=DEFAULT_ANSWER_HASH,
                question=DEFAULT_QUESTION,
            )
        return obj

    def __str__(self):
        return "Admin panel credentials"


def default_pricing():
    return {
        'unlocks': {'1': 49, '5': 199, '10': 399, 'unlimited': 999},
        'listings': {'roommate': 149, 'pg': 349, 'rental': 999},
    }


class SiteSettings(models.Model):
    """Singleton for things the admin edits once and every visitor sees (prices, contact details)."""
    pricing = models.JSONField(default=default_pricing)
    contact_email = models.CharField(max_length=255, default='setmystay02@gmail.com')
    contact_phone = models.CharField(max_length=30, default='+917977169550')
    contact_address = models.TextField(
        default='Office no. 01, Neelsidhi Splendour, Sector 15, CBD Belapur, Navi Mumbai, Maharashtra 400614'
    )
    updated_at = models.DateTimeField(auto_now=True)

    @classmethod
    def get(cls):
        obj = cls.objects.first()
        return obj or cls.objects.create()

    def __str__(self):
        return "Site settings"
