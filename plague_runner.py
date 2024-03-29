#!/usr/bin/env python3
#docker run -d -p 4444:4444 -v /dev/shm:/dev/shm selenium/standalone-chrome
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
import argparse
import time
class bcolors:
    HEADER = '\033[95m'
    OKBLUE = '\033[94m'
    OKCYAN = '\033[96m'
    OKGREEN = '\033[92m'
    WARNING = '\033[93m'
    FAIL = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'
    UNDERLINE = '\033[4m'

msg = "This is a command line tool for logging into the website associated with the webby CTF challenge. Please provide a URL to visit";
parser = argparse.ArgumentParser(description = msg);
parser.add_argument("-u", "--url",help = "Specify URL use a * to signify where to use the current iteration number");
parser.add_argument("-i","--iterations",help = "Number of iterations to make",type=int);
args = parser.parse_args();

if args.url:
    url = args.url
else:
    print("No URL specified");
    exit();

if args.iterations:
    iterations = args.iterations;
else:
    print ("Missing number of iterations");
    exit();


i = 0;
while i < iterations:
    i +=1
    options = Options();
    options.add_argument("--headless=new");
    options.add_argument("--disable-dev-shm-usage");
    options.add_argument("--no-sandbox");
    driver = webdriver.Remote("http://localhost:4444/wd/hub",options=options)
    try:
        driver.get(url.replace("*",str(i)));
        driver.find_element_by_name("email").send_keys("the_plague@ellingsonmineralcorporation.net");
        driver.find_element_by_name("password").send_keys("RowRowRowYourBoat");
        driver.find_element_by_name("login").click();
        element_text = driver.find_element_by_tag_name("p").get_attribute('innerHTML');
        print(f"{bcolors.OKGREEN}[+]{bcolors.ENDC} " + driver.current_url + " - " + driver.title);
        print(f"{bcolors.WARNING}[!] Current MOTD Contents:{bcolors.ENDC} ");
        print(element_text);
        print(f"{bcolors.OKCYAN}==={bcolors.ENDC}");
        driver.close();
        driver.quit();
    except Exception as e:
        print(f"{bcolors.FAIL}[!]{bcolors.ENDC} - " + url.replace("*",str(i)));
        print(e);
        driver.close();
        driver.quit();


