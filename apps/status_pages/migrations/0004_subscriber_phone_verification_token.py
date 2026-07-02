# Generated manually for phone verification token

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("status_pages", "0003_subscriber_phone"),
    ]

    operations = [
        migrations.AddField(
            model_name="statuspagesubscriber",
            name="phone_verification_token",
            field=models.CharField(blank=True, max_length=64),
        ),
    ]
