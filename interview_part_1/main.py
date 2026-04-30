from datetime import datetime, timedelta
import random
import time

# Q1: This function sometimes fails. How would you call it and retry if it throws?


def get_data(page):
    if random.random() < 0.1:
        raise Exception("API failed")


    return f"data for page {page}"

def make_retry_counter(call_next, *args):
    def add_retry_logic():
        retry = 5
        attempt = 0
        timeoutSeconds = 16
        backoffTimer = 2

        now = datetime.now()
        maxTimeout = now + timedelta(seconds=timeoutSeconds)

        print("starting time:", now)
        while attempt < retry:
            try:
                # get the current time
                print(call_next(*args))
                break
            except Exception as e:
                print(f"Error at attempt: {attempt}")
                backoffTimer= backoffTimer * 2

                now = datetime.now()
                timerWithBackoff = now + timedelta(seconds=backoffTimer)

                if timerWithBackoff > maxTimeout:
                    print(f"Timeout error: {now}")
                    break

                attempt = attempt + 1
                time.sleep(backoffTimer)

    return add_retry_logic


if __name__ == "__main__":
    api1 = make_retry_counter(get_data, 5)
    api1()

