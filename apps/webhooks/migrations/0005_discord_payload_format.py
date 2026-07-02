from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("webhooks", "0004_remove_webhook_webhooks_webhook_team_idx"),
    ]

    operations = [
        migrations.AlterField(
            model_name="webhook",
            name="payload_format",
            field=models.CharField(
                choices=[
                    ("json", "JSON (default)"),
                    ("slack", "Slack Incoming Webhook"),
                    ("teams", "Microsoft Teams Connector"),
                    ("discord", "Discord Webhook"),
                ],
                default="json",
                max_length=20,
            ),
        ),
    ]
