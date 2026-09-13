import pandas as pd
import numpy as np
import yfinance as yf
import smtplib
import os
import datetime as dt
import argparse
from dotenv import load_dotenv
from scipy.signal import argrelextrema
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.utils import formataddr
from email.header import Header

# Load environment variables from .env file
load_dotenv()

# Email configuration
mail_port = int(os.getenv("MAIL_PORT", 465))
mail_host = os.getenv("MAIL_HOST", "smtp.gmail.com")
sender_name = os.getenv("MAIL_USERNAME", "default_username")
sender_email = os.getenv("MAIL_EMAIL", "default_email")
receiver_email = sender_email
password = os.getenv("MAIL_PASSWORD", "password")


class Trade:

    def __init__(self, trigger, target, status=False, notified=0) -> None:
        self._stat = status # False = BUY, True = SELL
        self._trigger = trigger
        self._target = target
        self._notified = notified # 0 = BUY Not notified, 1 = BUY Notified, 2 = SELL Notified

    def status(self):
        return self._stat

    def trigger(self):
        return self._trigger 

    def target(self):
        return self._target
       
    def notified(self):
        return self._notified

    def toggleStatus(self):
        self._stat = not self._stat
        
    def setNotified(self, value: int):
        self._notified = value

    def __str__(self) -> str:
        return f"Status: {"BUY" if not self._stat else "SELL":<4}\nTrigger: ${self._trigger:<7}\nTarget: ${self._target:<7}\n"


def validate_trigger(value):
    """Validate that trigger is a float between 0 and 1."""
    f_value = float(value)
    if not (0 <= f_value <= 1):
        raise argparse.ArgumentTypeError("Trigger must be a float between 0 and 1.")
    return f_value

def validate_target(value):
    """Validate that target is a float greater than 0."""
    f_value = float(value)
    if f_value <= 0:
        raise argparse.ArgumentTypeError("Target must be a float greater than 0.")
    return f_value

def validate_entries(value):
    """Validate that entries is an integer greater than 0."""
    i_value = int(value)
    if i_value <= 0:
        raise argparse.ArgumentTypeError("Entries must be an integer greater than 0.")
    return i_value

def generate_trades(portfolio, trigger_percentage, target_percentage, trades_per_stock):

    stocks = { stock: [] for stock in portfolio }
    
    from decimal import Decimal, ROUND_HALF_UP

    for stock in stocks.keys():
        data = yf.download(stock, period='6mo', interval='1d', progress=False)
        price = data['High']
        maxlocal = argrelextrema(price.values,np.greater,order=20)
        local_max_values = price.iloc[maxlocal]
        lastmax = price.iloc[maxlocal].tail(1).values[0][0]

        for i in range(1, trades_per_stock + 1):
            trigger = round(lastmax * (1-trigger_percentage)**i, 2)
            target = round(trigger * (1+target_percentage), 2)
            stocks[stock].append(Trade(trigger,target))

    return stocks


def notify_log(message):
    print(f'{dt.datetime.now()} {message}')

def send_email(stock, entry):

    action_str = "BUY"
    if entry.status():
        action_str = "SELL"

    subject = f"{action_str}: {stock}"
    body = f"Nueva operación a realizar.\n\n{entry}"

    # Create a multipart message
    message = MIMEMultipart()
    message["From"] = formataddr((str(Header(sender_name, 'utf-8')), sender_email))
    message["To"] = receiver_email
    message["Subject"] = subject

    # Attach the body to the message
    message.attach(MIMEText(body, "plain"))

    # Send the email
    try:
        with smtplib.SMTP_SSL(mail_host, mail_port) as server:
            server.login(sender_email, password)
            server.sendmail(sender_email, receiver_email, message.as_string())
            notify_log(f"Email sent successfully: {stock}")
    except Exception as e:
        notify_log(f"Error: {e}")
        
            

if __name__ == '__main__':

    alarms_file_path = "C:\\Users\\facun\\scripts\\stocks-alarm\\data\\alarms.csv"
    stocks_file_path = "C:\\Users\\facun\\scripts\\stocks-alarm\\data\\stocks.csv"

    # Initialize the parser
    parser = argparse.ArgumentParser(description='Stocks alarm')

    # Add an optional argument
    parser.add_argument('--newtrades', help='generate new trades for every', action='store_true')

    # Add required positional arguments for when newtrades is set
    parser.add_argument('trigger', nargs='?', type=validate_trigger, help='Drawdown percentage for triggers. Eg: 0.2')
    parser.add_argument('target', nargs='?', type=validate_target, help='Target percentage for trades. Eg: 0.2')
    parser.add_argument('entries', nargs='?', type=validate_entries, default=3, help='Number of entries per trade. Default: 3')

    # Parse the arguments
    args = parser.parse_args()

    notify_log("Script triggered!")

    # Conditional action based on the optional argument
    if args.newtrades:
        if args.trigger is None or args.target is None:
            parser.error("When --newtrades is set, both trigger and target arguments must be provided.")

        notify_log(f"New trades will be generated. trigger: {args.trigger}, target: {args.target}, entries: {args.entries}")
        portfolio = pd.read_csv(stocks_file_path)['symbol'].tolist()
        new_trades = generate_trades(portfolio, args.trigger, args.target, args.entries)

        # Check if the CSV file exists
        if not os.path.isfile(alarms_file_path):
            with open(alarms_file_path, 'w') as f:
                f.write('symbol,trigger_price,target_price,trigger_percentage,target_percentage,status,date,notified\n')  

        # Store new Trades into the CSV file
        with open(alarms_file_path, 'a') as f:
            for stock in new_trades:
                for entry in new_trades[stock]:
                    f.write(f'{stock},{entry.trigger()},{entry.target()},{args.trigger},{args.target},{1 if entry.status() else 0},{dt.datetime.today().date()},{entry.notified()}\n')

    if not os.path.isfile(alarms_file_path):
        notify_log(f"File \"{alarms_file_path}\" does not exist!")
        exit(0)
    else:
        df = pd.read_csv(alarms_file_path)

    # Initialize an empty dictionary to hold the trades
    trades_dict = {}

    # Populate the dictionary
    for index, row in df.iterrows():
        symbol = row['symbol']
        trade = Trade(row['trigger_price'], row['target_price'], True if row['status'] == 1 else False, row['notified'])

        if symbol not in trades_dict:
            trades_dict[symbol] = []
        
        trades_dict[symbol].append(trade)

    # Checks for new price hits to happen
    try:
        df_changed = False
        
        for stock in trades_dict:
            price = yf.download(stock, period='1d', progress=False, auto_adjust=True)[["Low", "High"]]
            price_min = price["Low"].min().iloc[0]
            price_max = price["High"].max().iloc[0]

            for entry in trades_dict[stock]:
                # If BUY/SELL entry was already notified, just ignore it
                if (entry.notified() == 1 and not entry.status()) or (entry.notified() == 2 and entry.status()):
                    continue
                # Check if critical price is hit
                if (entry.status() == False and price_min <= entry.trigger()) or (entry.status() and price_max >= entry.target()):
                    send_email(stock, entry)
                    entry.setNotified(entry.notified() + 1)

                    # Modify entry within Pandas DF
                    mask = (
                        (df['symbol'] == stock) &
                        (df['trigger_price'] == entry.trigger()) &
                        (df['target_price'] == entry.target())
                    )
                    if mask.any():
                        df.loc[mask, 'notified'] = entry.notified()
                        df_changed = True
         
        notify_log("Trade verification completed without any errors.")
        
        if df_changed:
            df.to_csv(alarms_file_path, index=False)            
            notify_log("Alarms dataset updated successfully!")
    except Exception as e:
        notify_log(f"Error: {e}")
